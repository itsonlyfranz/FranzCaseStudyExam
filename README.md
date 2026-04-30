# FulfillIQ WMS

FulfillIQ WMS is a demoable warehouse management system case study built with Next.js. It focuses on the three core workflows a warehouse operator needs to manage day-to-day execution: inventory control, order fulfillment, and an agentic AI assistant that can answer operational questions or open controlled action forms.

The app is designed for a technical case study interview: it includes seeded warehouse data, demo authentication, local persistence, a dark operations dashboard UI, and AI orchestration through Groq, OpenRouter, and LangChain.

## Main Features

### 1. Inventory & SKU Management

- View a searchable SKU master list with quantity, category, location/bin, supplier, reorder point, target stock, and stock status.
- Add, edit, and deactivate SKUs.
- Track low-stock, healthy, overstock, and inactive states.
- Persist demo changes in `localStorage` so the app can be tested across page reloads.
- Record initial stock from new SKU creation as stock activity for later AI retrieval.

### 2. Order Fulfillment

- Manage orders across `Pending`, `Picking`, `Packed`, `Shipped`, and `Blocked` statuses.
- Inspect order line items, required quantities, available inventory, and pick locations.
- Start picking, mark packed, and ship orders.
- Deduct inventory when an order ships.
- Block shipment when stock is insufficient.

### 3. Agentic WMS Chatbot

- Uses Groq for streaming chat and action decisions.
- Uses OpenRouter embeddings with LangChain for local in-memory RAG over live warehouse data.
- Answers questions about stock, orders, bins, reorder risk, and recent stock activity.
- Shows a muted collapsible Thinking panel with tool-call progress.
- Renders markdown and tables for inventory/order lists.
- Opens controlled inline forms from chat:
  - Receive stock for an existing SKU.
  - Add a new SKU using the same fields as the Inventory page.
- Requires user confirmation before any inventory mutation.

## Demo Data

The app ships with seeded warehouse data:

- Demo warehouse SKUs across packaging, supplies, cold storage, returns, and warehouse equipment.
- Bin/location examples such as `Aisle A / Bin A-01`, `Bulk Rack / BR-12`, and `Returns Bay / RB-02`.
- Fulfillment orders with mixed statuses.
- Stock movement history for receiving, shipping, adjustments, and newly created SKUs.
- Low-stock and reorder-risk examples for AI and dashboard testing.

## Demo Login

Use the seeded demo credentials:

```txt
Email: ops@fulfilliq.demo
Password: warehouse123
```

Login/logout is included as supporting infrastructure and is not counted as one of the three main case study features.

## AI Setup

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required environment variables:

```bash
GROQ_API_KEY=your_groq_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
OPENROUTER_EMBEDDING_MODEL=text-embedding-3-small
```

Notes:

- `GROQ_MODEL` defaults to `openai/gpt-oss-20b`.
- `OPENROUTER_EMBEDDING_MODEL` defaults to `text-embedding-3-small`.
- Core WMS workflows still work without AI keys.
- When AI keys are missing, the chatbot shows an AI configuration fallback and does not open mutation forms.
- Groq prompt caching is automatic on supported models. The default model is set to `openai/gpt-oss-20b` so the stable prompt prefix can use Groq's prompt-caching path.

## Agentic Guardrails

The AI is intentionally bounded for this demo:

- The LLM can only request structured UI actions: `open_receive_stock_form`, `open_add_sku_form`, or `no_action`.
- The browser never mutates inventory directly from free text.
- Receiving stock and adding SKUs require a user-confirmed form.
- Read-only questions such as latest restock, inventory totals, order feasibility, and locations should not open mutation forms.
- Add SKU confirmation blocks missing required fields and duplicate SKU codes.
- Receive stock confirmation blocks missing SKUs and non-positive quantities.

## Example Chat Prompts

Try these prompts in the WMS Agent sidebar:

```txt
Which SKUs are below reorder point?
Can we fulfill order ORD-1004?
Where is SKU BOX-12 stored?
List down all stock we have on inventory
What was the latest restock we had?
Receive 10 units of BOX-12
Add stock for packing tape
Add a new SKU
Create SKU TEST-01 for Test Product with 20 units
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the local URL shown by Next.js, then log in with the demo credentials.

## Verification

Run the standard checks:

```bash
npm run lint
npm run build
```

Suggested manual test flow:

1. Log in with the seeded demo credentials.
2. Add, edit, and deactivate a SKU from Inventory.
3. Move an order through picking, packed, and shipped.
4. Verify shipped orders deduct inventory.
5. Ask the chatbot for low-stock SKUs.
6. Ask the chatbot to list inventory and verify the table renders.
7. Ask the chatbot to receive stock and confirm the inline form.
8. Ask the chatbot to add a new SKU and confirm the full add-SKU form.
9. Ask for the latest restock and verify it reflects recent stock activity.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- CSS modules through global design tokens
- LangChain
- Groq chat model
- OpenRouter embeddings
- Local/in-memory vector search
- Browser `localStorage` persistence for demo data

## Deployment

This app can be deployed on Vercel, Render, or exposed locally through ngrok for demo purposes.

For Vercel:

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add the required AI environment variables.
4. Deploy and share the Vercel URL.

The final deliverables for the case study are the GitHub repository and a demo URL.
