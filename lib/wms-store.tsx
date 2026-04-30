"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initialState, seedSkus } from "./seed-data";
import { OrderStatus, ReceiveStockDraft, Sku, StockMovement, WmsState } from "./types";
import { canFulfillOrder, uid } from "./wms-utils";

const STORAGE_KEY = "fulfilliq-wms-state";
const SESSION_KEY = "fulfilliq-session";

type WmsContextValue = {
  state: WmsState;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  resetDemo: () => void;
  addSku: (sku: Omit<Sku, "id" | "createdAt">) => void;
  updateSku: (sku: Sku) => void;
  deactivateSku: (skuId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => { ok: boolean; message: string };
  receiveStock: (draft: ReceiveStockDraft) => { ok: boolean; message: string; movement?: StockMovement };
};

const WmsContext = createContext<WmsContextValue | null>(null);
const seedCreatedAtById = new Map(seedSkus.map((sku) => [sku.id, sku.createdAt]));

export function WmsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WmsState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const session = window.localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setState(normalizeWmsState(JSON.parse(stored) as WmsState));
      } catch {
        setState(initialState);
      }
    }
    setIsAuthenticated(session === "active");
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [isReady, state]);

  const value = useMemo<WmsContextValue>(() => {
    function login(email: string, password: string) {
      const ok = email.trim().toLowerCase() === "ops@fulfilliq.demo" && password === "warehouse123";
      if (ok) {
        window.localStorage.setItem(SESSION_KEY, "active");
        setIsAuthenticated(true);
      }
      return ok;
    }

    function logout() {
      window.localStorage.removeItem(SESSION_KEY);
      setIsAuthenticated(false);
    }

    function resetDemo() {
      setState(initialState);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    }

    function addSku(sku: Omit<Sku, "id" | "createdAt">) {
      setState((current) => {
        const createdAt = new Date().toISOString();
        const newSku: Sku = { ...sku, id: uid("sku"), createdAt };
        const creationMovement: StockMovement | null =
          sku.quantity > 0
            ? {
                id: uid("mov"),
                skuId: newSku.id,
                type: "Received",
                quantity: sku.quantity,
                note: "Initial stock from new SKU creation",
                createdAt
              }
            : null;

        return {
          ...current,
          skus: [newSku, ...current.skus],
          movements: creationMovement ? [creationMovement, ...current.movements] : current.movements
        };
      });
    }

    function updateSku(sku: Sku) {
      setState((current) => ({
        ...current,
        skus: current.skus.map((item) => (item.id === sku.id ? sku : item))
      }));
    }

    function deactivateSku(skuId: string) {
      setState((current) => ({
        ...current,
        skus: current.skus.map((item) => (item.id === skuId ? { ...item, status: "Inactive" } : item))
      }));
    }

    function updateOrderStatus(orderId: string, status: OrderStatus) {
      let result = { ok: true, message: `Order ${orderId} moved to ${status}.` };
      setState((current) => {
        const order = current.orders.find((item) => item.id === orderId);
        if (!order) {
          result = { ok: false, message: "Order was not found." };
          return current;
        }

        if (status === "Shipped") {
          const availability = canFulfillOrder(order, current.skus);
          if (!availability.canFulfill) {
            result = { ok: false, message: `Order ${orderId} is blocked because inventory is insufficient.` };
            return {
              ...current,
              orders: current.orders.map((item) => (item.id === orderId ? { ...item, status: "Blocked" } : item))
            };
          }

          const shippedMovements = order.lines.map((line) => ({
            id: uid("mov"),
            skuId: line.skuId,
            type: "Shipped" as const,
            quantity: -line.quantity,
            note: `Shipped on ${orderId}`,
            createdAt: new Date().toISOString()
          }));

          return {
            skus: current.skus.map((sku) => {
              const line = order.lines.find((item) => item.skuId === sku.id);
              return line ? { ...sku, quantity: sku.quantity - line.quantity } : sku;
            }),
            orders: current.orders.map((item) => (item.id === orderId ? { ...item, status } : item)),
            movements: [...shippedMovements, ...current.movements]
          };
        }

        return {
          ...current,
          orders: current.orders.map((item) => (item.id === orderId ? { ...item, status } : item))
        };
      });
      return result;
    }

    function receiveStock(draft: ReceiveStockDraft) {
      let result = { ok: false, message: "SKU was not found." } as { ok: boolean; message: string; movement?: StockMovement };
      setState((current) => {
        const sku = current.skus.find((item) => item.id === draft.skuId);
        if (!sku || draft.quantity <= 0) {
          result = { ok: false, message: !sku ? "SKU was not found." : "Quantity must be greater than zero." };
          return current;
        }

        const movement: StockMovement = {
          id: uid("mov"),
          skuId: draft.skuId,
          type: "Received",
          quantity: draft.quantity,
          note: draft.supplierNote || `Received into ${draft.destination}`,
          createdAt: new Date().toISOString()
        };

        result = {
          ok: true,
          message: `${draft.quantity} units received for ${sku.code}. New stock: ${sku.quantity + draft.quantity}.`,
          movement
        };

        return {
          skus: current.skus.map((item) =>
            item.id === draft.skuId ? { ...item, quantity: item.quantity + draft.quantity, location: draft.destination || item.location } : item
          ),
          orders: current.orders,
          movements: [movement, ...current.movements]
        };
      });
      return result;
    }

    return {
      state,
      isReady,
      isAuthenticated,
      login,
      logout,
      resetDemo,
      addSku,
      updateSku,
      deactivateSku,
      updateOrderStatus,
      receiveStock
    };
  }, [isAuthenticated, isReady, state]);

  return <WmsContext.Provider value={value}>{children}</WmsContext.Provider>;
}

export function useWms() {
  const context = useContext(WmsContext);
  if (!context) {
    throw new Error("useWms must be used inside WmsProvider");
  }
  return context;
}

function normalizeWmsState(state: WmsState): WmsState {
  const migrationTimestamp = new Date().toISOString();
  const normalizedSkus = state.skus.map((sku) => ({
    ...sku,
    createdAt: sku.createdAt || seedCreatedAtById.get(sku.id) || migrationTimestamp
  }));

  const existingCreationMovementSkuIds = new Set(
    state.movements.filter((movement) => movement.note === "Initial stock from new SKU creation").map((movement) => movement.skuId)
  );
  const knownSeedIds = new Set(seedSkus.map((sku) => sku.id));
  const migratedCreationMovements = normalizedSkus
    .filter((sku) => !knownSeedIds.has(sku.id) && sku.quantity > 0 && !existingCreationMovementSkuIds.has(sku.id))
    .map((sku) => ({
      id: uid("mov"),
      skuId: sku.id,
      type: "Received" as const,
      quantity: sku.quantity,
      note: "Initial stock from new SKU creation",
      createdAt: sku.createdAt
    }));

  return {
    skus: normalizedSkus,
    orders: state.orders,
    movements: [...migratedCreationMovements, ...state.movements]
  };
}
