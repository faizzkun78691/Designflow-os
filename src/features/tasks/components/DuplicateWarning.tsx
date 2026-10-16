import { TriangleAlert } from "lucide-react";

/** Non-blocking duplicate-task warning banner (returned by create_task). */
export function DuplicateWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <TriangleAlert
        className="mt-0.5 size-5 shrink-0 text-amber-400"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-300">
          Possible duplicate task
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-amber-200/80">
          {message}
        </p>
      </div>
    </div>
  );
}
