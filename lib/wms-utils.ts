import { Order, Sku, StockHealth, WmsState } from "./types";

export function stockHealth(sku: Sku): StockHealth {
  if (sku.quantity <= sku.reorderPoint) return "Low";
  if (sku.quantity <= Math.round(sku.reorderPoint * 1.35)) return "Watch";
  if (sku.quantity >= Math.round(sku.targetStock * 1.25)) return "Overstock";
  return "Healthy";
}

export function getSku(state: WmsState, skuId: string) {
  return state.skus.find((sku) => sku.id === skuId);
}

export function canFulfillOrder(order: Order, skus: Sku[]) {
  const shortages = order.lines
    .map((line) => {
      const sku = skus.find((item) => item.id === line.skuId);
      return {
        sku,
        required: line.quantity,
        available: sku?.quantity ?? 0,
        shortage: Math.max(line.quantity - (sku?.quantity ?? 0), 0)
      };
    })
    .filter((line) => line.shortage > 0);

  return {
    canFulfill: shortages.length === 0,
    shortages
  };
}

export function orderItemCount(order: Order) {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function buildWarehouseDocuments(state: WmsState) {
  const skuDocs = state.skus.map((sku) => {
    const health = stockHealth(sku);
    return `SKU ${sku.code}: ${sku.name}. Category ${sku.category}. Quantity ${sku.quantity}. Reorder point ${sku.reorderPoint}. Target stock ${sku.targetStock}. Location ${sku.location}. Supplier ${sku.supplier}. Status ${sku.status}. Stock health ${health}. Created at ${sku.createdAt || "unknown"}.`;
  });

  const orderDocs = state.orders.map((order) => {
    const lines = order.lines
      .map((line) => {
        const sku = getSku(state, line.skuId);
        return `${line.quantity} of ${sku?.code ?? line.skuId}`;
      })
      .join(", ");
    const availability = canFulfillOrder(order, state.skus);
    return `Order ${order.id} for ${order.customer}. Priority ${order.priority}. Status ${order.status}. Ship by ${order.shipBy}. Lines: ${lines}. Fulfillable: ${availability.canFulfill ? "yes" : "no"}.`;
  });

  const movementDocs = state.movements.map((movement) => {
    const sku = getSku(state, movement.skuId);
    return `Stock movement ${movement.id}: ${movement.type} ${movement.quantity} units for SKU ${sku?.code ?? movement.skuId} (${sku?.name ?? "unknown item"}). Source ${movement.note}. Timestamp ${movement.createdAt}.`;
  });

  return [buildRecentStockActivityDocument(state), ...skuDocs, ...orderDocs, ...movementDocs];
}

function buildRecentStockActivityDocument(state: WmsState) {
  const receivedStockActivities = state.movements
    .filter((movement) => movement.type === "Received")
    .map((movement) => {
      const sku = getSku(state, movement.skuId);
      return {
        timestamp: movement.createdAt,
        text: `${movement.createdAt}: Stock receiving activity. SKU ${sku?.code ?? movement.skuId} (${sku?.name ?? "unknown item"}) received ${movement.quantity} units. Source: ${movement.note}.`
      };
    });

  const skuCreationActivities = state.skus.map((sku) => ({
    timestamp: sku.createdAt || "unknown",
    text: `${sku.createdAt || "unknown"}: SKU creation activity. SKU ${sku.code} (${sku.name}) was created with ${sku.quantity} units on hand. Source: SKU creation.`
  }));

  const recentActivities = [...receivedStockActivities, ...skuCreationActivities]
    .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))
    .slice(0, 8)
    .map((activity, index) => `${index + 1}. ${activity.text}`)
    .join(" ");

  return `Recent stock activity index for latest, recent, newest, or most recent stock questions. Use this document to answer what stock was most recently added. Activities are sorted newest first. ${recentActivities}`;
}

function timestampValue(timestamp: string) {
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? 0 : value;
}
