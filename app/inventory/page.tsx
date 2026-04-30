"use client";

import { FormEvent, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { warehouseLocations } from "@/lib/seed-data";
import { Sku } from "@/lib/types";
import { useWms } from "@/lib/wms-store";
import { currency, stockHealth } from "@/lib/wms-utils";
import { Plus, Save, Trash2 } from "lucide-react";

type SkuDraft = Omit<Sku, "id" | "createdAt">;

const emptySku = {
  code: "",
  name: "",
  category: "Packaging",
  quantity: 0,
  reorderPoint: 10,
  targetStock: 100,
  location: warehouseLocations[0],
  supplier: "",
  unitCost: 1,
  status: "Active" as const
};

export default function InventoryPage() {
  const { state, addSku, updateSku, deactivateSku } = useWms();
  const [query, setQuery] = useState("");
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [draft, setDraft] = useState<SkuDraft>(emptySku);

  const filteredSkus = useMemo(() => {
    const normalized = query.toLowerCase();
    return state.skus.filter((sku) => `${sku.code} ${sku.name} ${sku.category} ${sku.location}`.toLowerCase().includes(normalized));
  }, [query, state.skus]);

  function startEdit(sku: Sku) {
    setEditingSku(sku);
    setDraft({
      code: sku.code,
      name: sku.name,
      category: sku.category,
      quantity: sku.quantity,
      reorderPoint: sku.reorderPoint,
      targetStock: sku.targetStock,
      location: sku.location,
      supplier: sku.supplier,
      unitCost: sku.unitCost,
      status: sku.status
    });
  }

  function resetForm() {
    setEditingSku(null);
    setDraft(emptySku);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.code.trim() || !draft.name.trim()) return;
    if (editingSku) {
      updateSku({ ...draft, id: editingSku.id, createdAt: editingSku.createdAt });
    } else {
      addSku(draft);
    }
    resetForm();
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">SKU control</p>
          <h1>Inventory</h1>
        </div>
        <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU, name, category, bin..." />
      </div>

      <section className="inventory-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>{editingSku ? `Edit ${editingSku.code}` : "Add SKU"}</h2>
            {editingSku ? <button className="secondary-button" onClick={resetForm}>Cancel</button> : null}
          </div>
          <form className="grid-form" onSubmit={handleSubmit}>
            <label>
              SKU code
              <input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} required />
            </label>
            <label>
              Name
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
            </label>
            <label>
              Category
              <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
            </label>
            <label>
              Supplier
              <input value={draft.supplier} onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} />
            </label>
            <label>
              Quantity
              <input type="number" min="0" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} />
            </label>
            <label>
              Reorder point
              <input type="number" min="0" value={draft.reorderPoint} onChange={(event) => setDraft({ ...draft, reorderPoint: Number(event.target.value) })} />
            </label>
            <label>
              Target stock
              <input type="number" min="0" value={draft.targetStock} onChange={(event) => setDraft({ ...draft, targetStock: Number(event.target.value) })} />
            </label>
            <label>
              Unit cost
              <input type="number" min="0" step="0.01" value={draft.unitCost} onChange={(event) => setDraft({ ...draft, unitCost: Number(event.target.value) })} />
            </label>
            <label>
              Bin/location
              <select value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })}>
                {warehouseLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button full">
              {editingSku ? <Save size={16} /> : <Plus size={16} />}
              {editingSku ? "Save SKU" : "Add SKU"}
            </button>
          </form>
        </div>

        <div className="panel wide">
          <div className="panel-header">
            <h2>SKU master</h2>
            <span>{filteredSkus.length} records</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Reorder</th>
                  <th>Location</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map((sku) => (
                  <tr key={sku.id}>
                    <td>
                      <button className="link-button" onClick={() => startEdit(sku)}>
                        {sku.code}
                      </button>
                      <span>{sku.name}</span>
                    </td>
                    <td>{sku.category}</td>
                    <td>{sku.quantity}</td>
                    <td>{sku.reorderPoint}</td>
                    <td>{sku.location}</td>
                    <td>{currency(sku.quantity * sku.unitCost)}</td>
                    <td>
                      <StatusBadge value={sku.status === "Inactive" ? "Inactive" : stockHealth(sku)} />
                    </td>
                    <td>
                      <button className="icon-button danger" aria-label={`Deactivate ${sku.code}`} onClick={() => deactivateSku(sku.id)}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
