"use client";

import { WmsProvider } from "@/lib/wms-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return <WmsProvider>{children}</WmsProvider>;
}
