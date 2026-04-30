import { Order, Sku, StockMovement, WmsState } from "./types";

export const demoCredentials = {
  email: "ops@fulfilliq.demo",
  password: "warehouse123"
};

export const warehouseLocations = [
  "Aisle A / Bin A-01",
  "Aisle A / Bin A-04",
  "Aisle B / Bin B-02",
  "Aisle C / Bin C-08",
  "Bulk Rack / BR-12",
  "Cold Storage / CS-03",
  "Packing Area / PK-01",
  "Returns Bay / RB-02"
];

export const seedSkus: Sku[] = [
  { id: "sku-1", code: "BOX-12", name: "12x12 Corrugated Box", category: "Packaging", quantity: 42, reorderPoint: 80, targetStock: 240, location: "Aisle A / Bin A-01", supplier: "PackSource", unitCost: 1.15, status: "Active", createdAt: "2026-04-22T08:00:00.000Z" },
  { id: "sku-2", code: "TAPE-02", name: "Heavy Duty Packing Tape", category: "Packaging", quantity: 18, reorderPoint: 50, targetStock: 180, location: "Packing Area / PK-01", supplier: "PackSource", unitCost: 2.45, status: "Active", createdAt: "2026-04-22T08:05:00.000Z" },
  { id: "sku-3", code: "LBL-THERM", name: "Thermal Shipping Labels", category: "Packaging", quantity: 320, reorderPoint: 120, targetStock: 450, location: "Aisle A / Bin A-04", supplier: "LabelWorks", unitCost: 0.08, status: "Active", createdAt: "2026-04-22T08:10:00.000Z" },
  { id: "sku-4", code: "GLV-NIT-M", name: "Nitrile Gloves Medium", category: "Safety", quantity: 74, reorderPoint: 90, targetStock: 260, location: "Aisle B / Bin B-02", supplier: "SafeHands", unitCost: 4.35, status: "Active", createdAt: "2026-04-22T08:15:00.000Z" },
  { id: "sku-5", code: "PAL-WOOD", name: "Standard Wood Pallet", category: "Handling", quantity: 126, reorderPoint: 40, targetStock: 110, location: "Bulk Rack / BR-12", supplier: "PalletPro", unitCost: 8.75, status: "Active", createdAt: "2026-04-22T08:20:00.000Z" },
  { id: "sku-6", code: "ICE-GEL", name: "Gel Ice Pack", category: "Cold Chain", quantity: 22, reorderPoint: 60, targetStock: 180, location: "Cold Storage / CS-03", supplier: "FrostLine", unitCost: 0.92, status: "Active", createdAt: "2026-04-22T08:25:00.000Z" },
  { id: "sku-7", code: "WRAP-18", name: "18in Stretch Wrap", category: "Handling", quantity: 88, reorderPoint: 35, targetStock: 120, location: "Bulk Rack / BR-12", supplier: "WrapCo", unitCost: 11.4, status: "Active", createdAt: "2026-04-22T08:30:00.000Z" },
  { id: "sku-8", code: "SCAN-BTRY", name: "Scanner Battery Pack", category: "Equipment", quantity: 9, reorderPoint: 12, targetStock: 36, location: "Aisle C / Bin C-08", supplier: "DeviceHub", unitCost: 31.5, status: "Active", createdAt: "2026-04-22T08:35:00.000Z" },
  { id: "sku-9", code: "PICK-TOTE", name: "Blue Picking Tote", category: "Handling", quantity: 210, reorderPoint: 70, targetStock: 200, location: "Aisle C / Bin C-08", supplier: "ToteWorks", unitCost: 5.6, status: "Active", createdAt: "2026-04-22T08:40:00.000Z" },
  { id: "sku-10", code: "DUN-14", name: "14in Dunnage Paper", category: "Packaging", quantity: 31, reorderPoint: 45, targetStock: 150, location: "Packing Area / PK-01", supplier: "VoidFill Co", unitCost: 6.1, status: "Active", createdAt: "2026-04-22T08:45:00.000Z" },
  { id: "sku-11", code: "SEAL-TAMP", name: "Tamper Evident Seal", category: "Security", quantity: 610, reorderPoint: 200, targetStock: 700, location: "Aisle B / Bin B-02", supplier: "SealRight", unitCost: 0.18, status: "Active", createdAt: "2026-04-22T08:50:00.000Z" },
  { id: "sku-12", code: "RET-BAG", name: "Return Mailer Bag", category: "Returns", quantity: 16, reorderPoint: 45, targetStock: 140, location: "Returns Bay / RB-02", supplier: "MailPro", unitCost: 0.74, status: "Active", createdAt: "2026-04-22T08:55:00.000Z" }
];

export const seedOrders: Order[] = [
  { id: "ORD-1001", customer: "BrightMart", priority: "High", status: "Pending", shipBy: "2026-05-01", lines: [{ skuId: "sku-1", quantity: 12 }, { skuId: "sku-2", quantity: 6 }, { skuId: "sku-3", quantity: 60 }] },
  { id: "ORD-1002", customer: "Northstar Retail", priority: "Normal", status: "Picking", shipBy: "2026-05-01", lines: [{ skuId: "sku-7", quantity: 8 }, { skuId: "sku-9", quantity: 24 }] },
  { id: "ORD-1003", customer: "ColdCrate Foods", priority: "Rush", status: "Blocked", shipBy: "2026-04-30", lines: [{ skuId: "sku-6", quantity: 50 }, { skuId: "sku-1", quantity: 8 }] },
  { id: "ORD-1004", customer: "Urban Goods", priority: "High", status: "Pending", shipBy: "2026-05-02", lines: [{ skuId: "sku-8", quantity: 8 }, { skuId: "sku-10", quantity: 20 }, { skuId: "sku-2", quantity: 10 }] },
  { id: "ORD-1005", customer: "DailyKart", priority: "Normal", status: "Packed", shipBy: "2026-05-03", lines: [{ skuId: "sku-5", quantity: 12 }, { skuId: "sku-11", quantity: 100 }] },
  { id: "ORD-1006", customer: "Returnly Hub", priority: "Normal", status: "Pending", shipBy: "2026-05-03", lines: [{ skuId: "sku-12", quantity: 12 }, { skuId: "sku-3", quantity: 40 }] },
  { id: "ORD-1007", customer: "Harbor Supply", priority: "Rush", status: "Pending", shipBy: "2026-05-01", lines: [{ skuId: "sku-4", quantity: 80 }, { skuId: "sku-2", quantity: 12 }] },
  { id: "ORD-1008", customer: "Metro Fulfill", priority: "Normal", status: "Shipped", shipBy: "2026-04-29", lines: [{ skuId: "sku-9", quantity: 30 }, { skuId: "sku-1", quantity: 20 }] }
];

export const seedMovements: StockMovement[] = [
  { id: "mov-1", skuId: "sku-1", type: "Received", quantity: 80, note: "Inbound PO 7481", createdAt: "2026-04-27T08:30:00.000Z" },
  { id: "mov-2", skuId: "sku-2", type: "Shipped", quantity: -24, note: "Outbound wave W-220", createdAt: "2026-04-28T11:20:00.000Z" },
  { id: "mov-3", skuId: "sku-6", type: "Shipped", quantity: -44, note: "Cold chain rush orders", createdAt: "2026-04-29T10:15:00.000Z" },
  { id: "mov-4", skuId: "sku-8", type: "Adjusted", quantity: -3, note: "Cycle count variance", createdAt: "2026-04-29T16:10:00.000Z" }
];

export const initialState: WmsState = {
  skus: seedSkus,
  orders: seedOrders,
  movements: seedMovements
};
