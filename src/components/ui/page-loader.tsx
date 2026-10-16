import { Loader2 } from "lucide-react";

/** Fallback shown while a lazy route chunk loads. */
export function PageLoader() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-label="Loading page"
    >
      <Loader2 className="size-6 animate-spin text-volt" aria-hidden="true" />
    </div>
  );
}
