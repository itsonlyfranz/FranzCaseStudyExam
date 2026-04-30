"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWms } from "@/lib/wms-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useWms();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
    if (isAuthenticated && pathname === "/login") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isReady, pathname, router]);

  if (!isReady) {
    return <div className="loading-screen">Loading warehouse workspace...</div>;
  }

  if (!isAuthenticated && pathname !== "/login") {
    return <div className="loading-screen">Redirecting to login...</div>;
  }

  return <>{children}</>;
}
