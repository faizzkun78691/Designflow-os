import { AlertTriangle } from "lucide-react";
import { getMissingSupabaseEnv } from "../../integrations/supabase/client";
import { BrandLockup } from "../../components/brand/BrandLockup";
import { WaveBackground } from "../../components/brand/WaveBackground";

/**
 * Rendered outside ThemeProvider (see main.tsx), so this must not use the
 * theme hook — CSS variables still apply via data-theme on <html>, which the
 * inline bootstrap script in index.html sets before first paint.
 */
export function ConfigErrorScreen({ missing }: { missing: string[] }) {
  return (
    <div className="bg-app text-fg relative flex min-h-screen flex-col">
      <WaveBackground className="opacity-40" />
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="border-token bg-surface w-full max-w-lg animate-slide-up rounded-2xl border p-8 shadow-pop sm:p-10">
          <div className="flex justify-center">
            <BrandLockup />
          </div>
          <AlertTriangle className="mx-auto mt-7 h-12 w-12 text-volt" aria-hidden="true" />
          <h1 className="font-display mt-4 text-center text-2xl font-bold tracking-tight">
            Configuration required
          </h1>
          <p className="text-muted mt-2 text-center text-sm">
            The app is missing required environment variables:
          </p>
          <div
            className="mt-5 flex flex-wrap justify-center gap-2"
            role="list"
            aria-label="Missing variables"
          >
            {missing.map((name) => (
              <code
                key={name}
                role="listitem"
                className="rounded-md border border-volt/40 bg-volt/10 px-2.5 py-1.5 font-mono text-xs font-semibold text-volt"
              >
                {name}
              </code>
            ))}
          </div>
          <ol className="text-muted mt-7 list-decimal space-y-2.5 pl-5 text-sm">
            <li>
              Create a{" "}
              <code className="font-mono text-xs text-[var(--fg)]">.env</code> file from{" "}
              <code className="font-mono text-xs text-[var(--fg)]">.env.example</code>.
            </li>
            <li>
              Set the two Supabase variables (
              <code className="font-mono text-xs text-[var(--fg)]">
                VITE_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="font-mono text-xs text-[var(--fg)]">
                VITE_SUPABASE_ANON_KEY
              </code>
              ).
            </li>
            <li>Restart the dev server or redeploy the app.</li>
          </ol>
        </div>
      </main>
      <footer className="text-subtle relative z-10 px-4 pb-6 text-center text-xs">
        AWS Community Karachi — Design Operations &amp; Publishing Workspace
      </footer>
    </div>
  );
}

export default function ConfigErrorPage() {
  return <ConfigErrorScreen missing={getMissingSupabaseEnv()} />;
}
