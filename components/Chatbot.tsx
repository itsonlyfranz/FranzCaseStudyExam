"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWms } from "@/lib/wms-store";
import { ChatMessage, ReceiveStockDraft, Sku } from "@/lib/types";
import { buildWarehouseDocuments, uid } from "@/lib/wms-utils";
import { warehouseLocations } from "@/lib/seed-data";

type AddSkuDraft = Omit<Sku, "id" | "createdAt">;

type PendingAction = { type: "receive-stock"; draft: ReceiveStockDraft } | { type: "add-sku"; draft: AddSkuDraft };

type RenderItem = { type: "message"; message: ChatMessage } | { type: "tools"; id: string; tools: ChatMessage[] };

const starterPrompts = [
  "Which SKUs are below reorder point?",
  "Can we fulfill order ORD-1004?",
  "Where is SKU BOX-12 stored?",
  "Receive stock for packing tape"
];

const CHAT_STORAGE_KEY = "fulfilliq-agent-chat";
const PENDING_ACTION_STORAGE_KEY = "fulfilliq-agent-pending-action";
const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Ask about stock, orders, locations, or reorder risk. I can also open controlled receiving and add-SKU forms from chat."
};

const emptyAddSkuDraft: AddSkuDraft = {
  code: "",
  name: "",
  category: "Packaging",
  quantity: 0,
  reorderPoint: 10,
  targetStock: 100,
  location: warehouseLocations[0],
  supplier: "",
  unitCost: 1,
  status: "Active"
};

export function Chatbot() {
  const { state, addSku, receiveStock } = useWms();
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [hasLoadedChat, setHasLoadedChat] = useState(false);

  const documents = useMemo(() => buildWarehouseDocuments(state), [state]);
  const chatItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let toolGroup: ChatMessage[] = [];

    for (const message of messages) {
      if (message.role === "tool") {
        toolGroup.push(message);
        continue;
      }

      if (toolGroup.length) {
        items.push({ type: "tools", id: toolGroup.map((tool) => tool.id).join("-"), tools: toolGroup });
        toolGroup = [];
      }

      items.push({ type: "message", message });
    }

    if (toolGroup.length) {
      items.push({ type: "tools", id: toolGroup.map((tool) => tool.id).join("-"), tools: toolGroup });
    }

    return items;
  }, [messages]);

  useEffect(() => {
    try {
      const storedMessages = window.localStorage.getItem(CHAT_STORAGE_KEY);
      const storedPendingAction = window.localStorage.getItem(PENDING_ACTION_STORAGE_KEY);
      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages) as ChatMessage[];
        setMessages(parsedMessages.length ? parsedMessages : [welcomeMessage]);
      }
      if (storedPendingAction) {
        setPendingAction(JSON.parse(storedPendingAction) as PendingAction);
      }
    } catch {
      setMessages([welcomeMessage]);
      setPendingAction(null);
    } finally {
      setHasLoadedChat(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedChat) return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [hasLoadedChat, messages]);

  useEffect(() => {
    if (!hasLoadedChat) return;
    if (pendingAction) {
      window.localStorage.setItem(PENDING_ACTION_STORAGE_KEY, JSON.stringify(pendingAction));
    } else {
      window.localStorage.removeItem(PENDING_ACTION_STORAGE_KEY);
    }
  }, [hasLoadedChat, pendingAction]);

  async function submitPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setInput("");
    setMessages((current) => [...current, { id: uid("msg"), role: "user", content: trimmed }]);

    setIsThinking(true);
    const localAnswer = "The AI service is unavailable right now, so I cannot classify tool actions or run RAG for this message.";
    const assistantMessageId = uid("msg");
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, documents, state })
      });

      if (!response.ok || !response.body) {
        setMessages((current) => [...current, { id: uid("msg"), role: "assistant", content: localAnswer }]);
        return;
      }

      setMessages((current) => [...current, { id: assistantMessageId, role: "assistant", content: "" }]);
      await readAgentStream(response.body, assistantMessageId);
    } catch {
      setMessages((current) => [...current, { id: uid("msg"), role: "assistant", content: localAnswer }]);
    } finally {
      setIsThinking(false);
    }
  }

  async function readAgentStream(body: ReadableStream<Uint8Array>, assistantMessageId: string) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as {
          type: "tool" | "token" | "action" | "done";
          name?: string;
          status?: "running" | "complete" | "error";
          content?: string;
          draft?: ReceiveStockDraft | AddSkuDraft;
        };

        if (event.type === "tool") {
          setMessages((current) => upsertToolMessage(current, assistantMessageId, event.name, event.status, event.content ?? ""));
        }

        if (event.type === "action" && event.name === "open_receive_stock_form" && event.draft) {
          setPendingAction({ type: "receive-stock", draft: event.draft as ReceiveStockDraft });
          setMessages((current) =>
            upsertToolMessage(current, assistantMessageId, event.name, "complete", "Groq requested the controlled receive-stock form.")
          );
        }

        if (event.type === "action" && event.name === "open_add_sku_form" && event.draft) {
          setPendingAction({ type: "add-sku", draft: { ...emptyAddSkuDraft, ...(event.draft as AddSkuDraft) } });
          setMessages((current) => upsertToolMessage(current, assistantMessageId, event.name, "complete", "Groq requested the controlled add-SKU form."));
        }

        if (event.type === "token" && event.content) {
          setMessages((current) =>
            current.map((message) => (message.id === assistantMessageId ? { ...message, content: `${message.content}${event.content}` } : message))
          );
        }
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitPrompt(input);
  }

  function updateReceiveDraft(next: Partial<ReceiveStockDraft>) {
    if (!pendingAction || pendingAction.type !== "receive-stock") return;
    setPendingAction({
      ...pendingAction,
      draft: { ...pendingAction.draft, ...next }
    });
  }

  function updateAddSkuDraft(next: Partial<AddSkuDraft>) {
    if (!pendingAction || pendingAction.type !== "add-sku") return;
    setPendingAction({
      ...pendingAction,
      draft: { ...pendingAction.draft, ...next }
    });
  }

  function confirmReceiveStock() {
    if (!pendingAction || pendingAction.type !== "receive-stock") return;
    const selectedSku = state.skus.find((sku) => sku.id === pendingAction.draft.skuId);
    const result = receiveStock(pendingAction.draft);
    setMessages((current) => [
      ...current,
      {
        id: uid("msg"),
        role: "assistant",
        content:
          result.ok && selectedSku
            ? [
                "### Restock confirmed",
                `- **SKU:** ${selectedSku.code} - ${selectedSku.name}`,
                `- **Quantity received:** ${pendingAction.draft.quantity}`,
                `- **New stock:** ${selectedSku.quantity + pendingAction.draft.quantity}`,
                `- **Destination:** ${pendingAction.draft.destination}`,
                `- **Recorded at:** ${result.movement?.createdAt ?? new Date().toISOString()}`,
                "",
                "The warehouse context is refreshed for future answers."
              ].join("\n")
            : result.message
      },
      {
        id: uid("msg"),
        role: "tool",
        toolName: "receive_stock",
        toolStatus: result.ok ? "complete" : "error",
        content: result.ok ? "Inventory quantity updated and stock movement recorded." : "Inventory update was rejected."
      }
    ]);
    setPendingAction(null);
  }

  function confirmAddSku() {
    if (!pendingAction || pendingAction.type !== "add-sku") return;
    const draft = {
      ...pendingAction.draft,
      code: pendingAction.draft.code.trim().toUpperCase(),
      name: pendingAction.draft.name.trim(),
      supplier: pendingAction.draft.supplier.trim()
    };

    if (!draft.code || !draft.name) {
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "assistant",
          content: "SKU code and name are required before I can add this SKU."
        },
        {
          id: uid("msg"),
          role: "tool",
          toolName: "add_sku",
          toolStatus: "error",
          content: "Add SKU confirmation was rejected because required fields are missing."
        }
      ]);
      return;
    }

    const duplicateSku = state.skus.find((sku) => sku.code.toLowerCase() === draft.code.toLowerCase());
    if (duplicateSku) {
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "assistant",
          content: `SKU ${draft.code} already exists as ${duplicateSku.name}. Edit the SKU code before confirming.`
        },
        {
          id: uid("msg"),
          role: "tool",
          toolName: "add_sku",
          toolStatus: "error",
          content: "Add SKU confirmation was rejected because the SKU code already exists."
        }
      ]);
      return;
    }

    const recordedAt = new Date().toISOString();
    addSku(draft);
    setMessages((current) => [
      ...current,
      {
        id: uid("msg"),
        role: "assistant",
        content: [
          "### SKU added",
          `- **SKU:** ${draft.code} - ${draft.name}`,
          `- **Initial quantity:** ${draft.quantity}`,
          `- **Category:** ${draft.category}`,
          `- **Supplier:** ${draft.supplier || "Not specified"}`,
          `- **Bin/location:** ${draft.location}`,
          `- **Reorder point:** ${draft.reorderPoint}`,
          `- **Target stock:** ${draft.targetStock}`,
          `- **Unit cost:** ${draft.unitCost}`,
          `- **Recorded at:** ${recordedAt}`,
          "",
          "The SKU is now available in inventory."
        ].join("\n")
      },
      {
        id: uid("msg"),
        role: "tool",
        toolName: "add_sku",
        toolStatus: "complete",
        content: "New SKU record created and initial stock movement recorded when quantity was greater than zero."
      }
    ]);
    setPendingAction(null);
  }

  function clearChat() {
    setMessages([welcomeMessage]);
    setPendingAction(null);
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    window.localStorage.removeItem(PENDING_ACTION_STORAGE_KEY);
  }

  return (
    <div className="chatbot">
      <div className="chat-messages">
        {chatItems.map((item) =>
          item.type === "tools" ? (
            <ThinkingPanel key={item.id} tools={item.tools} />
          ) : (
            item.message.content ? (
              <div key={item.message.id} className={`chat-message ${item.message.role}`}>
                <ChatMessageContent message={item.message} />
              </div>
            ) : null
          )
        )}
        {pendingAction?.type === "receive-stock" ? (
          <div className="chat-form-card">
            <div>
              <strong>Receive stock</strong>
              <p>Controlled action. Inventory updates only after confirmation.</p>
            </div>
            <label>
              SKU
              <select value={pendingAction.draft.skuId} onChange={(event) => updateReceiveDraft({ skuId: event.target.value })}>
                {state.skus
                  .filter((sku) => sku.status === "Active")
                  .map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.code} - {sku.name} ({sku.quantity} on hand)
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Quantity received
              <input type="number" min="1" value={pendingAction.draft.quantity} onChange={(event) => updateReceiveDraft({ quantity: Number(event.target.value) })} />
            </label>
            <label>
              Supplier/reference note
              <input value={pendingAction.draft.supplierNote} onChange={(event) => updateReceiveDraft({ supplierNote: event.target.value })} />
            </label>
            <label>
              Destination bin
              <select value={pendingAction.draft.destination} onChange={(event) => updateReceiveDraft({ destination: event.target.value })}>
                {warehouseLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-actions">
              <button className="primary-button" onClick={confirmReceiveStock}>
                <Check size={15} />
                Confirm
              </button>
              <button className="secondary-button" onClick={() => setPendingAction(null)}>
                <X size={15} />
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {pendingAction?.type === "add-sku" ? (
          <div className="chat-form-card">
            <div>
              <strong>Add SKU</strong>
              <p>Controlled action. The SKU is created only after confirmation.</p>
            </div>
            <div className="chat-sku-grid">
              <label>
                SKU code
                <input value={pendingAction.draft.code} onChange={(event) => updateAddSkuDraft({ code: event.target.value.toUpperCase() })} />
              </label>
              <label>
                Name
                <input value={pendingAction.draft.name} onChange={(event) => updateAddSkuDraft({ name: event.target.value })} />
              </label>
              <label>
                Category
                <input value={pendingAction.draft.category} onChange={(event) => updateAddSkuDraft({ category: event.target.value })} />
              </label>
              <label>
                Supplier
                <input value={pendingAction.draft.supplier} onChange={(event) => updateAddSkuDraft({ supplier: event.target.value })} />
              </label>
              <label>
                Quantity
                <input type="number" min="0" value={pendingAction.draft.quantity} onChange={(event) => updateAddSkuDraft({ quantity: Number(event.target.value) })} />
              </label>
              <label>
                Reorder point
                <input
                  type="number"
                  min="0"
                  value={pendingAction.draft.reorderPoint}
                  onChange={(event) => updateAddSkuDraft({ reorderPoint: Number(event.target.value) })}
                />
              </label>
              <label>
                Target stock
                <input
                  type="number"
                  min="0"
                  value={pendingAction.draft.targetStock}
                  onChange={(event) => updateAddSkuDraft({ targetStock: Number(event.target.value) })}
                />
              </label>
              <label>
                Unit cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pendingAction.draft.unitCost}
                  onChange={(event) => updateAddSkuDraft({ unitCost: Number(event.target.value) })}
                />
              </label>
              <label className="chat-form-wide">
                Bin/location
                <select value={pendingAction.draft.location} onChange={(event) => updateAddSkuDraft({ location: event.target.value })}>
                  {warehouseLocations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inline-actions">
              <button className="primary-button" onClick={confirmAddSku}>
                <Check size={15} />
                Confirm
              </button>
              <button className="secondary-button" onClick={() => setPendingAction(null)}>
                <X size={15} />
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {isThinking ? <div className="chat-message assistant">Checking warehouse context...</div> : null}
      </div>

      <div className="starter-list">
        <button onClick={clearChat}>Clear chat</button>
        {starterPrompts.map((prompt) => (
          <button key={prompt} onClick={() => void submitPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about stock, orders, or receiving..." />
        <button aria-label="Send message">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function ChatMessageContent({ message }: { message: ChatMessage }) {
  if (message.role !== "assistant") {
    return <>{message.content}</>;
  }

  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  );
}

function upsertToolMessage(messages: ChatMessage[], assistantMessageId: string, name?: string, status?: "running" | "complete" | "error", content = "") {
  const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
  const searchStart = assistantIndex >= 0 ? assistantIndex + 1 : 0;
  const existingIndex = messages.findIndex((message, index) => index >= searchStart && message.role === "tool" && message.toolName === name);

  if (existingIndex >= 0) {
    return messages.map((message, messageIndex) =>
      messageIndex === existingIndex
        ? {
            ...message,
            toolStatus: status,
            content
          }
        : message
    );
  }

  const toolMessage: ChatMessage = {
    id: uid("msg"),
    role: "tool",
    toolName: name,
    toolStatus: status,
    content
  };

  if (assistantIndex < 0) {
    return [...messages, toolMessage];
  }

  let insertIndex = assistantIndex + 1;
  while (insertIndex < messages.length && messages[insertIndex].role === "tool") {
    insertIndex += 1;
  }

  return [...messages.slice(0, insertIndex), toolMessage, ...messages.slice(insertIndex)];
}

function ThinkingPanel({ tools }: { tools: ChatMessage[] }) {
  const isRunning = tools.some((tool) => tool.toolStatus === "running");
  const hasError = tools.some((tool) => tool.toolStatus === "error");
  const [isOpen, setIsOpen] = useState(isRunning || hasError);

  useEffect(() => {
    if (isRunning || hasError) {
      setIsOpen(true);
      return;
    }
    setIsOpen(false);
  }, [hasError, isRunning]);

  return (
    <div className={`thinking-panel ${hasError ? "error" : isRunning ? "running" : "complete"}`}>
      <button className="thinking-summary" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span>Thinking</span>
        <small>{tools.length} tool {tools.length === 1 ? "call" : "calls"}</small>
      </button>
      {isOpen ? (
        <div className="thinking-details">
          {tools.map((tool) => (
            <div key={tool.id} className={`thinking-tool ${tool.toolStatus ?? ""}`}>
              <span>{tool.toolStatus ?? "tool"}</span>
              <strong>{formatToolName(tool.toolName)}</strong>
              <p>{tool.content}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatToolName(name?: string) {
  return (name ?? "tool").replaceAll("_", " ");
}
