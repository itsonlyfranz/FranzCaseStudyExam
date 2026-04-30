# Agentic WMS Case Study Demo Plan

## Summary
Build a same-day **Next.js WMS demo** deployed on **Vercel**, with demo auth, three core WMS features, and a real AI layer:

1. **Inventory & SKU Management**
2. **Order Fulfillment**
3. **Agentic Sidebar RAG Chatbot**

Use **Groq** for the chat/agent LLM, **OpenRouter** for embeddings, and **LangChain** for retrieval, tool calling, and agent orchestration.

## Key Changes / Implementation
- Build the app routes:
  - `/login`
  - `/dashboard`
  - `/inventory`
  - `/orders`
- Add a persistent app shell with:
  - Sidebar navigation.
  - Right-side AI chatbot panel available across authenticated screens.
  - Demo login/logout with protected routes.
- Feature 1: Inventory & SKU Management
  - SKU table with search, filters, stock status, location/bin, reorder point, and quantity.
  - Add, edit, deactivate/remove SKUs.
  - Persist demo state in browser storage.
- Feature 2: Order Fulfillment
  - Orders list with statuses: `Pending`, `Picking`, `Packed`, `Shipped`, `Blocked`.
  - Order detail view with line items, SKU availability, and pick locations.
  - Fulfillment flow: start picking, mark packed, ship.
  - Shipping deducts inventory.
  - Insufficient inventory blocks shipment.
- Feature 3: Agentic Sidebar RAG Chatbot
  - Chatbot can answer questions like:
    - “Which SKUs are low stock?”
    - “Can we fulfill order ORD-1004?”
    - “What items should we reorder?”
    - “Where is SKU A-102 stored?”
  - RAG retrieves from live demo data:
    - SKUs
    - stock levels
    - reorder points
    - warehouse locations
    - orders
    - fulfillment status
  - LangChain tools allow the agent to:
    - Query inventory.
    - Query orders.
    - Check fulfillment feasibility.
    - Recommend reorder quantities.
    - Add a SKU.
    - Adjust stock.
    - Move an order through fulfillment.
  - For data-changing actions, the chatbot must show a confirmation step before applying the change.
- AI architecture:
  - Groq handles chat completions and agent reasoning.
  - OpenRouter generates embeddings for inventory/order documents.
  - LangChain coordinates:
    - document creation from app state
    - embeddings
    - vector similarity search
    - tool calls
    - final chatbot responses
  - Use in-memory/local vector storage for the demo.
  - Rebuild or refresh the local index when inventory/order state changes.
- Environment variables:
  - `GROQ_API_KEY`
  - `OPENROUTER_API_KEY`
  - optional `GROQ_MODEL`
  - optional `OPENROUTER_EMBEDDING_MODEL`
- Fallback behavior:
  - If API keys are missing, show a clear AI unavailable state.
  - Core WMS features must still work without AI.

## Test Plan
- Manual WMS demo:
  - Log in with seeded demo credentials.
  - Add a SKU.
  - Edit stock quantity and reorder point.
  - Deactivate/remove a SKU.
  - Start picking an order.
  - Pack and ship an order.
  - Verify shipped orders deduct stock.
  - Verify blocked orders cannot ship with insufficient stock.
- Manual AI demo:
  - Ask the chatbot for low-stock SKUs.
  - Ask whether a specific order can be fulfilled.
  - Ask for reorder recommendations.
  - Ask where a SKU is stored.
  - Ask the agent to adjust stock, then confirm the action.
  - Verify app data updates after confirmed agent actions.
  - Verify chatbot answers reflect updated inventory/order state.
- Build/deploy verification:
  - Run `npm run lint`.
  - Run `npm run build`.
  - Deploy to Vercel.
  - Configure Groq and OpenRouter API keys in Vercel environment variables.
  - Verify the deployed chatbot works from the production URL.

## Assumptions
- The three main case-study features are **inventory management**, **order fulfillment**, and the **agentic RAG chatbot**.
- Login/logout is required but treated as platform support, not one of the three core WMS features.
- The demo remains **Next.js-only**, so operational data and vector search are stored locally/in-memory rather than in a database.
- Groq is used for LLM responses and agent reasoning.
- OpenRouter is used for embeddings.
- LangChain is required for the agent, tool calls, and RAG flow.
- The chatbot is allowed to update data only after explicit user confirmation.
