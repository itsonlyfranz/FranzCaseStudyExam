import { OrderStatus, StockHealth } from "@/lib/types";

export function StatusBadge({ value }: { value: StockHealth | OrderStatus | "Active" | "Inactive" | "High" | "Rush" | "Normal" }) {
  return <span className={`badge ${value.toLowerCase()}`}>{value}</span>;
}
