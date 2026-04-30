"use client";

import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useWms } from "@/lib/wms-store";
import { canFulfillOrder, currency, orderItemCount, stockHealth } from "@/lib/wms-utils";
import { AlertTriangle, CheckCircle2, PackageCheck, PackageSearch } from "lucide-react";

export default function DashboardPage() {
  const { state } = useWms();
  const activeSkus = state.skus.filter((sku) => sku.status === "Active");
  const lowStock = activeSkus.filter((sku) => stockHealth(sku) === "Low");
  const openOrders = state.orders.filter((order) => order.status !== "Shipped");
  const fulfillableOpenOrders = openOrders.filter((order) => canFulfillOrder(order, state.skus).canFulfill);
  const inventoryValue = activeSkus.reduce((sum, sku) => sum + sku.quantity * sku.unitCost, 0);

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Warehouse command center</p>
          <h1>Dashboard</h1>
        </div>
        <div className="warehouse-status">Live demo data</div>
      </div>

      <section className="metric-grid">
        <div className="metric-card">
          <PackageSearch />
          <span>Active SKUs</span>
          <strong>{activeSkus.length}</strong>
        </div>
        <div className="metric-card warning">
          <AlertTriangle />
          <span>Low stock</span>
          <strong>{lowStock.length}</strong>
        </div>
        <div className="metric-card">
          <PackageCheck />
          <span>Open orders</span>
          <strong>{openOrders.length}</strong>
        </div>
        <div className="metric-card success">
          <CheckCircle2 />
          <span>Fulfillable</span>
          <strong>{fulfillableOpenOrders.length}/{openOrders.length}</strong>
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="panel-header">
            <h2>Reorder watchlist</h2>
            <span>{currency(inventoryValue)} stock value</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Reorder</th>
                  <th>Location</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 6).map((sku) => (
                  <tr key={sku.id}>
                    <td>
                      <strong>{sku.code}</strong>
                      <span>{sku.name}</span>
                    </td>
                    <td>{sku.quantity}</td>
                    <td>{sku.reorderPoint}</td>
                    <td>{sku.location}</td>
                    <td>
                      <StatusBadge value={stockHealth(sku)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Fulfillment queue</h2>
            <span>{openOrders.length} open</span>
          </div>
          <div className="order-list compact">
            {openOrders.slice(0, 6).map((order) => (
              <div key={order.id} className="order-row">
                <div>
                  <strong>{order.id}</strong>
                  <span>{order.customer} · {orderItemCount(order)} units</span>
                </div>
                <StatusBadge value={order.status} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
