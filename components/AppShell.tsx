"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bot, Boxes, ClipboardList, LogOut, RotateCcw, Warehouse } from "lucide-react";
import { Chatbot } from "./Chatbot";
import { AuthGate } from "./AuthGate";
import { useWms } from "@/lib/wms-store";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/orders", label: "Orders", icon: ClipboardList }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, resetDemo } = useWms();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <AuthGate>
      <div className="workspace">
        <aside className="main-sidebar">
          <div className="brand">
            <div className="brand-mark">
              <Warehouse size={22} />
            </div>
            <div>
              <strong>FulfillIQ</strong>
              <span>Metro Warehouse</span>
            </div>
          </div>

          <nav className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={pathname === item.href ? "nav-item active" : "nav-item"}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-actions">
            <button className="ghost-button" onClick={resetDemo}>
              <RotateCcw size={16} />
              Reset demo
            </button>
            <button className="ghost-button" onClick={handleLogout}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        <main className="content-area">{children}</main>

        <aside className="agent-sidebar">
          <div className="agent-title">
            <Bot size={18} />
            WMS Agent
          </div>
          <Chatbot />
        </aside>
      </div>
    </AuthGate>
  );
}
