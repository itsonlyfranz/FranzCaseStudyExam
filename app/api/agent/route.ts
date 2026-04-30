import { NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ReceiveStockDraft, Sku, WmsState } from "@/lib/types";
import { warehouseLocations } from "@/lib/seed-data";

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_OPENROUTER_EMBEDDING_MODEL = "text-embedding-3-small";

// Groq prompt caching is automatic and depends on exact prefix matches.
// Keep this system prompt stable; put dynamic warehouse context and user input in the final user message.
const WMS_AGENT_SYSTEM_PROMPT =
  "You are a WMS operations agent for FulfillIQ. Answer concisely using only provided warehouse context. Use markdown tables for multi-row inventory, order, or stock lists. If the user asks about latest, recent, newest, or most recent stock, use timestamped stock activity context and say whether the result came from SKU creation or stock receiving. If Selected UI action is open_receive_stock_form, say the receive-stock form is open and tell the user to review the SKU, quantity, and destination before confirming. If Selected UI action is open_add_sku_form, say the add-SKU form is open and tell the user to review the SKU details before confirming. If the user asks to change inventory but no Selected UI action is present, explain that the inline controlled form must be used for confirmation.";

const WMS_ACTION_SYSTEM_PROMPT =
  "You decide whether a WMS chat message should open a controlled warehouse form. Return only JSON. Use open_receive_stock_form for clear inventory receiving, adding stock to an existing SKU, inbound delivery, or restocking actions. Generic action requests like 'I want to restock' or 'open restock form' should return open_receive_stock_form even if SKU or quantity is missing, because the UI form is the clarification and confirmation layer. Use open_add_sku_form only when the user clearly wants to create, register, or add a new SKU/product record. Do not open any form for read-only questions about latest restock, recent stock, history, totals, locations, order feasibility, or reports. If the user is ambiguous and does not clearly request a stock mutation form, return no_action and let the assistant ask a clarifying question.";

type AddSkuDraft = Omit<Sku, "id" | "createdAt">;

type AgentRequest = {
  question?: string;
  documents?: string[];
  state?: WmsState;
};

type GroqUsageLog = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
};

type ActionDecision = {
  action: "open_receive_stock_form" | "open_add_sku_form" | "no_action";
  draft?: Partial<ReceiveStockDraft> & Partial<AddSkuDraft>;
  reason?: string;
};

type NormalizedAction =
  | {
      name: "open_receive_stock_form";
      draft: ReceiveStockDraft;
    }
  | {
      name: "open_add_sku_form";
      draft: AddSkuDraft;
    };

export async function POST(request: Request) {
  const body = (await request.json()) as AgentRequest;
  const question = body.question?.trim();
  const docs = body.documents ?? [];
  const requestId = `agent-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const groqModel = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || DEFAULT_OPENROUTER_EMBEDDING_MODEL;

  if (!question) {
    return NextResponse.json({ answer: "Ask a warehouse operations question first.", configured: false }, { status: 400 });
  }

  console.log(`[${requestId}] Agent request started`, {
    question,
    documentCount: docs.length,
    groqModel,
    embeddingModel
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      if (!process.env.GROQ_API_KEY || !process.env.OPENROUTER_API_KEY) {
        console.log(`[${requestId}] Missing AI configuration`, {
          hasGroqKey: Boolean(process.env.GROQ_API_KEY),
          hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY)
        });
        send({
          type: "tool",
          name: "ai_config_check",
          status: "error",
          content: "Groq or OpenRouter key is missing. Streaming local fallback response."
        });
        send({
          type: "token",
          content: "AI keys are not configured yet. I can still answer from the browser-side warehouse tools, but Groq streaming and OpenRouter embeddings need `.env.local` values."
        });
        send({ type: "done" });
        controller.close();
        return;
      }

      try {
        const actionDecision = await decideWarehouseAction({
          question,
          state: body.state,
          groqModel,
          requestId
        });
        const selectedAction = normalizeAction(actionDecision, body.state);

        send({
          type: "tool",
          name: "llm_action_decision",
          status: "complete",
          content: selectedAction
            ? `Groq selected ${selectedAction.name}. ${actionDecision.reason ?? ""}`.trim()
            : `Groq selected no_action. ${actionDecision.reason ?? ""}`.trim()
        });

        if (selectedAction) {
          send({
            type: "action",
            name: selectedAction.name,
            draft: selectedAction.draft
          });
        }

        console.log(`[${requestId}] OpenRouter embeddings started`, { documentCount: docs.length });
        send({
          type: "tool",
          name: "openrouter_embeddings",
          status: "running",
          content: `Embedding ${docs.length} live warehouse records.`
        });

        const embeddings = new OpenAIEmbeddings({
          apiKey: process.env.OPENROUTER_API_KEY,
          model: embeddingModel,
          configuration: {
            baseURL: "https://openrouter.ai/api/v1"
          }
        });

        const [documentEmbeddings, queryEmbedding] = await Promise.all([embeddings.embedDocuments(docs), embeddings.embedQuery(question)]);
        console.log(`[${requestId}] OpenRouter embeddings completed`, {
          documentEmbeddingCount: documentEmbeddings.length,
          queryDimensions: queryEmbedding.length
        });
        send({
          type: "tool",
          name: "openrouter_embeddings",
          status: "complete",
          content: "Embeddings generated for retrieval."
        });

        console.log(`[${requestId}] Warehouse vector search started`);
        send({
          type: "tool",
          name: "warehouse_vector_search",
          status: "running",
          content: "Searching SKUs, orders, locations, reorder points, and movement history."
        });

        const matches = documentEmbeddings
          .map((embedding, index) => ({
            text: docs[index],
            score: cosineSimilarity(queryEmbedding, embedding)
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        const context = matches.map((match) => match.text).join("\n");
        console.log(`[${requestId}] Warehouse vector search completed`, {
          matchCount: matches.length,
          topScores: matches.map((match) => Number(match.score.toFixed(4)))
        });

        send({
          type: "tool",
          name: "warehouse_vector_search",
          status: "complete",
          content: `Retrieved ${matches.length} relevant warehouse records.`
        });

        console.log(`[${requestId}] Groq stream started`);
        send({
          type: "tool",
          name: "groq_wms_agent",
          status: "running",
          content: "Streaming final operational answer from Groq."
        });

        const model = new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: groqModel,
          temperature: 0.2,
          streaming: true
        });

        const response = await model.stream([
          {
            role: "system",
            content: WMS_AGENT_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: `Dynamic warehouse context:\n${context}\n\nAvailable active SKUs:\n${buildActiveSkuReference(body.state)}\n\nSelected UI action:\n${selectedAction ? JSON.stringify(selectedAction) : "none"}\n\nUser question:\n${question}`
          }
        ], {
          stream_options: {
            include_usage: true
          }
        });

        let tokenCount = 0;
        let usageLog: GroqUsageLog | null = null;
        for await (const chunk of response) {
          usageLog = extractGroqUsage(chunk) ?? usageLog;
          const content = typeof chunk.content === "string" ? chunk.content : "";
          if (content) {
            tokenCount += 1;
            console.log(`[${requestId}] Groq token chunk`, {
              tokenCount,
              characters: content.length,
              preview: content.slice(0, 80)
            });
            send({ type: "token", content });
          }
        }

        console.log(`[${requestId}] Groq stream completed`, { tokenCount });
        logGroqUsage(requestId, usageLog);
        send({
          type: "tool",
          name: "groq_wms_agent",
          status: "complete",
          content: "Answer stream completed."
        });
        send({ type: "done" });
      } catch (error) {
        console.error(`[${requestId}] Agent stream failed`, error);
        send({
          type: "tool",
          name: "agent_runtime",
          status: "error",
          content: error instanceof Error ? error.message : "The streaming agent failed."
        });
        send({
          type: "token",
          content: "The AI provider call failed. The browser-side warehouse tools can still answer the same question from live demo data."
        });
        send({ type: "done" });
      }
      console.log(`[${requestId}] Agent request closed`);
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  const length = Math.min(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    aMagnitude += a[index] * a[index];
    bMagnitude += b[index] * b[index];
  }

  if (!aMagnitude || !bMagnitude) return 0;
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

async function decideWarehouseAction({
  question,
  state,
  groqModel,
  requestId
}: {
  question: string;
  state?: WmsState;
  groqModel: string;
  requestId: string;
}): Promise<ActionDecision> {
  if (!state) {
    return { action: "no_action", reason: "No warehouse state was provided." };
  }

  try {
    console.log(`[${requestId}] Groq action decision started`);
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: groqModel,
      temperature: 0,
      streaming: false
    });

    const response = await model.invoke(
      [
        {
          role: "system",
          content: WMS_ACTION_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `User message:\n${question}\n\nActive SKU reference:\n${buildActiveSkuReference(state)}\n\nWarehouse bins:\n${warehouseLocations.join(", ")}\n\nReturn JSON in this exact shape:\n{"action":"open_receive_stock_form"|"open_add_sku_form"|"no_action","draft":{"skuId":"active SKU id when receiving known SKU, otherwise empty string","code":"new SKU code when creating SKU","name":"new SKU name when creating SKU","category":"new SKU category","supplier":"supplier name","quantity":number,"reorderPoint":number,"targetStock":number,"unitCost":number,"location":"warehouse bin","supplierNote":"short receiving note","destination":"warehouse bin for receiving"},"reason":"short reason"}\nFor no_action, omit draft. For open_receive_stock_form, use skuId, quantity, supplierNote, and destination. For open_add_sku_form, use code, name, category, supplier, quantity, reorderPoint, targetStock, unitCost, and location.`
        }
      ],
      {
        response_format: { type: "json_object" }
      }
    );

    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const decision = parseActionDecision(content);
    console.log(`[${requestId}] Groq action decision completed`, decision);
    return decision;
  } catch (error) {
    console.error(`[${requestId}] Groq action decision failed`, error);
    return { action: "no_action", reason: "Action decision failed." };
  }
}

function parseActionDecision(content: string): ActionDecision {
  try {
    const parsed = JSON.parse(content) as ActionDecision;
    if (isKnownAction(parsed.action)) {
      return parsed;
    }
  } catch {
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as ActionDecision;
        if (isKnownAction(parsed.action)) {
          return parsed;
        }
      } catch {
        return { action: "no_action", reason: "Action JSON was not parseable." };
      }
    }
  }

  return { action: "no_action", reason: "Action JSON was not parseable." };
}

function isKnownAction(action: unknown): action is ActionDecision["action"] {
  return action === "open_receive_stock_form" || action === "open_add_sku_form" || action === "no_action";
}

function normalizeAction(decision: ActionDecision, state?: WmsState): NormalizedAction | null {
  if (decision.action === "open_receive_stock_form") {
    const draft = normalizeReceiveStockDraft(decision, state);
    return draft ? { name: "open_receive_stock_form", draft } : null;
  }

  if (decision.action === "open_add_sku_form") {
    return {
      name: "open_add_sku_form",
      draft: normalizeAddSkuDraft(decision)
    };
  }

  return null;
}

function normalizeReceiveStockDraft(decision: ActionDecision, state?: WmsState): ReceiveStockDraft | null {
  if (!state) return null;
  const activeSkus = state.skus.filter((item) => item.status === "Active");
  const draft = decision.draft ?? {};
  const sku = activeSkus.find((item) => item.id === draft.skuId) ?? activeSkus[0];
  if (!sku) return null;

  const quantity = typeof draft.quantity === "number" && draft.quantity > 0 ? Math.round(draft.quantity) : 1;
  return {
    skuId: sku.id,
    quantity,
    supplierNote: draft.supplierNote || "Received through WMS agent",
    destination: draft.destination || sku.location
  };
}

function normalizeAddSkuDraft(decision: ActionDecision): AddSkuDraft {
  const draft = decision.draft ?? {};
  const location = warehouseLocations.includes(draft.location ?? "") ? draft.location ?? warehouseLocations[0] : warehouseLocations[0];

  return {
    code: (draft.code ?? "").toUpperCase(),
    name: draft.name ?? "",
    category: draft.category || "Packaging",
    quantity: nonNegativeNumber(draft.quantity, 0),
    reorderPoint: nonNegativeNumber(draft.reorderPoint, 10),
    targetStock: nonNegativeNumber(draft.targetStock, 100),
    location,
    supplier: draft.supplier ?? "",
    unitCost: nonNegativeNumber(draft.unitCost, 1),
    status: "Active"
  };
}

function nonNegativeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function buildActiveSkuReference(state?: WmsState) {
  if (!state) return "No active SKU reference available.";
  return state.skus
    .filter((sku) => sku.status === "Active")
    .map((sku) => `- id=${sku.id}; code=${sku.code}; name=${sku.name}; quantity=${sku.quantity}; location=${sku.location}; supplier=${sku.supplier}`)
    .join("\n");
}

function logGroqUsage(requestId: string, usage: GroqUsageLog | null) {
  if (!usage || usage.promptTokens === undefined) {
    console.log(`[${requestId}] Groq usage metrics unavailable for streamed response`);
    return;
  }

  const cacheHitRate =
    usage.promptTokens && usage.cachedTokens !== undefined ? Number(((usage.cachedTokens / usage.promptTokens) * 100).toFixed(2)) : undefined;

  console.log(`[${requestId}] Groq usage metrics`, {
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens: usage.totalTokens,
    cached_tokens: usage.cachedTokens,
    cache_hit_rate: cacheHitRate === undefined ? "unavailable" : `${cacheHitRate}%`
  });
}

function extractGroqUsage(chunk: unknown): GroqUsageLog | null {
  const record = asRecord(chunk);
  const usageMetadata = asRecord(record?.usage_metadata);
  const responseMetadata = asRecord(record?.response_metadata);
  const responseUsage = asRecord(responseMetadata?.usage);
  const xGroq = asRecord(responseMetadata?.x_groq);
  const xGroqUsage = asRecord(xGroq?.usage);
  const tokenUsage = asRecord(responseMetadata?.tokenUsage);

  const promptTokens =
    numberValue(usageMetadata?.input_tokens) ??
    numberValue(responseUsage?.prompt_tokens) ??
    numberValue(responseUsage?.input_tokens) ??
    numberValue(xGroqUsage?.prompt_tokens) ??
    numberValue(tokenUsage?.promptTokens);
  const completionTokens =
    numberValue(usageMetadata?.output_tokens) ??
    numberValue(responseUsage?.completion_tokens) ??
    numberValue(responseUsage?.output_tokens) ??
    numberValue(xGroqUsage?.completion_tokens) ??
    numberValue(tokenUsage?.completionTokens);
  const totalTokens =
    numberValue(usageMetadata?.total_tokens) ??
    numberValue(responseUsage?.total_tokens) ??
    numberValue(xGroqUsage?.total_tokens) ??
    numberValue(tokenUsage?.totalTokens);
  const responsePromptDetails = asRecord(responseUsage?.prompt_tokens_details);
  const xGroqPromptDetails = asRecord(xGroqUsage?.prompt_tokens_details);
  const inputTokenDetails = asRecord(usageMetadata?.input_token_details);
  const cachedTokens =
    numberValue(responsePromptDetails?.cached_tokens) ??
    numberValue(xGroqPromptDetails?.cached_tokens) ??
    numberValue(inputTokenDetails?.cache_read);

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined && cachedTokens === undefined) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
