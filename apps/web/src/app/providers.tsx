"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 10_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              className:
                "!border !border-[var(--line)] !bg-[var(--panel-strong)] !text-[var(--ink)]",
            }}
          />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
