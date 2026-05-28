"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, hydrated } = useAuth();
  const { loading: storeLoading, error: storeError } = useStore();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser && !isLoginPage) router.replace("/login");
    if (currentUser && isLoginPage) router.replace("/");
  }, [hydrated, currentUser, isLoginPage, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (isLoginPage) {
    return <main className="min-h-screen bg-background flex">{children}</main>;
  }

  if (!currentUser) return null; // mid-redirect

  return (
    <div className="min-h-screen flex bg-background text-text">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-7">
            {storeError && (
              <div className="mb-4 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                Database error: {storeError}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
