import { createContext, useContext, type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used inside <Tabs>");
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-token bg-surface p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { value: activeValue, onValueChange } = useTabsContext();
  const selected = activeValue === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onValueChange(value)}
      className={cn(
        "flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt",
        selected
          ? "bg-volt font-semibold text-black"
          : "text-muted hover:bg-surface-2 hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { value: activeValue } = useTabsContext();
  if (activeValue !== value) return null;
  return (
    <div role="tabpanel" className={cn("pt-4", className)}>
      {children}
    </div>
  );
}
