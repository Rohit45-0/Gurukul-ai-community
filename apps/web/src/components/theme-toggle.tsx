"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme";

function subscribeToHydration() {
  return () => undefined;
}

export function ThemeToggle({
  className,
}: {
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex h-11 w-[132px] items-center rounded-full border border-[var(--line)] bg-[var(--panel-muted)] p-1 shadow-[var(--soft-shadow)]",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] p-1 shadow-[var(--soft-shadow)]",
        className,
      )}
    >
      {[
        { id: "light", label: "Light", icon: Sun },
        { id: "dark", label: "Dark", icon: Moon },
      ].map((option) => {
        const Icon = option.icon;
        const active = theme === option.id;

        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition",
              active
                ? "bg-[var(--ink)] text-[var(--panel-strong)]"
                : "text-[var(--ink-soft)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
            )}
            key={option.id}
            onClick={() => setTheme(option.id as "light" | "dark")}
            type="button"
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}

      <span className="hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--ink-soft)] lg:inline-flex">
        <Monitor className="size-3.5" />
        Theme
      </span>
    </div>
  );
}
