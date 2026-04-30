export type SkuStatus = "Active" | "Inactive";
export type OrderStatus = "Pending" | "Picking" | "Packed" | "Shipped" | "Blocked";
export type StockHealth = "Low" | "Watch" | "Healthy" | "Overstock";

export type Sku = {
  id: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  reorderPoint: number;
  targetStock: number;
  location: string;
  supplier: string;
  unitCost: number;
  status: SkuStatus;
  createdAt: string;
};

export type OrderLine = {
  skuId: string;
  quantity: number;
};

export type Order = {
  id: string;
  customer: string;
  priority: "Normal" | "High" | "Rush";
  status: OrderStatus;
  shipBy: string;
  lines: OrderLine[];
};

export type StockMovement = {
  id: string;
  skuId: string;
  type: "Received" | "Shipped" | "Adjusted";
  quantity: number;
  note: string;
  createdAt: string;
};

export type WmsState = {
  skus: Sku[];
  orders: Order[];
  movements: StockMovement[];
};

export type ChatRole = "assistant" | "user" | "tool";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  toolName?: string;
  toolStatus?: "running" | "complete" | "error";
};

export type ReceiveStockDraft = {
  skuId: string;
  quantity: number;
  supplierNote: string;
  destination: string;
};
