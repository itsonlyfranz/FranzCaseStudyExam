"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Order } from "@/lib/types";
import { useWms } from "@/lib/wms-store";
import { canFulfillOrder, getSku, orderItemCount } from "@/lib/wms-utils";
import { CheckCircle2, PackageCheck, Truck } from "lucide-react";

export default function OrdersPage() {
  const { state, updateOrderStatus } = useWms();
  const [selectedId, setSelectedId] = useState(state.orders[0]?.id ?? "");
  const selectedOrder = useMemo(() => state.orders.find((order) => order.id === selectedId) ?? state.orders[0], [selectedId, state.orders]);
  const [notice, setNotice] = useState("");

  function moveOrder(order: Order, nextStatus: "Picking" | "Packed" | "Shipped") {
    const result = updateOrderStatus(order.id, nextStatus);
    setNotice(result.message);
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Outbound execution</p>
          <h1>Orders</h1>
        </div>
        {notice ? <div className="warehouse-status">{notice}</div> : null}
      </div>

      <section className="orders-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Fulfillment queue</h2>
            <span>{state.orders.length} orders</span>
          </div>
          <div className="order-list">
            {state.orders.map((order) => (
              <button key={order.id} className={selectedOrder?.id === order.id ? "order-card selected" : "order-card"} onClick={() => setSelectedId(order.id)}>
                <div>
                  <strong>{order.id}</strong>
                  <span>{order.customer}</span>
                </div>
                <div className="order-meta">
                  <StatusBadge value={order.status} />
                  <span>{orderItemCount(order)} units</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedOrder ? (
          <div className="panel wide">
            <div className="panel-header">
              <div>
                <h2>{selectedOrder.id}</h2>
                <span>{selectedOrder.customer} · Ship by {selectedOrder.shipBy}</span>
              </div>
              <StatusBadge value={selectedOrder.status} />
            </div>

            <div className="fulfillment-actions">
              <button className="secondary-button" disabled={selectedOrder.status === "Shipped"} onClick={() => moveOrder(selectedOrder, "Picking")}>
                <PackageCheck size={16} />
                Start picking
              </button>
              <button className="secondary-button" disabled={selectedOrder.status === "Shipped"} onClick={() => moveOrder(selectedOrder, "Packed")}>
                <CheckCircle2 size={16} />
                Mark packed
              </button>
              <button className="primary-button" disabled={selectedOrder.status === "Shipped"} onClick={() => moveOrder(selectedOrder, "Shipped")}>
                <Truck size={16} />
                Ship order
              </button>
            </div>

            <OrderAvailability order={selectedOrder} />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Pick location</th>
                    <th>Required</th>
                    <th>Available</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.lines.map((line) => {
                    const sku = getSku(state, line.skuId);
                    const shortage = Math.max(line.quantity - (sku?.quantity ?? 0), 0);
                    return (
                      <tr key={line.skuId}>
                        <td>
                          <strong>{sku?.code ?? line.skuId}</strong>
                        </td>
                        <td>{sku?.name ?? "Unknown"}</td>
                        <td>{sku?.location ?? "Missing"}</td>
                        <td>{line.quantity}</td>
                        <td>{sku?.quantity ?? 0}</td>
                        <td>{shortage > 0 ? <StatusBadge value="Blocked" /> : <StatusBadge value="Active" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function OrderAvailability({ order }: { order: Order }) {
  const { state } = useWms();
  const availability = canFulfillOrder(order, state.skus);

  if (availability.canFulfill) {
    return <div className="notice success">All line items have enough available inventory.</div>;
  }

  return (
    <div className="notice danger">
      Shipment blocked: {availability.shortages.map((line) => `${line.sku?.code ?? "SKU"} short by ${line.shortage}`).join(", ")}
    </div>
  );
}
