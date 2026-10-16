import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import { BrandLockup } from "../../components/brand/BrandLockup";
import { WaveBackground } from "../../components/brand/WaveBackground";

export default function Unauthorized() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="bg-app text-fg relative flex min-h-screen flex-col">
      <WaveBackground className="opacity-50" />
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="border-token bg-surface w-full max-w-md animate-slide-up rounded-2xl border p-8 text-center shadow-pop sm:p-10">
          <div className="flex justify-center">
            <BrandLockup compact />
          </div>
          <ShieldAlert className="mx-auto mt-7 h-14 w-14 text-volt" aria-hidden="true" />
          <p className="font-display text-subtle mt-4 text-xs font-bold uppercase tracking-[0.24em]">
            403
          </p>
          <h1 className="font-display mt-1.5 text-2xl font-bold tracking-tight">
            Access denied
          </h1>
          <p className="text-muted mt-2 text-sm">
            Your role does not have access to this area.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="font-display h-12 flex-1 text-[15px] font-bold"
            >
              <Link to="/">Go to my dashboard</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 border-[var(--border-strong)] text-[var(--fg)] hover:bg-[var(--surface-2)]"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </main>
      <footer className="text-subtle relative z-10 px-4 pb-6 text-center text-xs">
        AWS Community Karachi — Design Operations &amp; Publishing Workspace
      </footer>
    </div>
  );
}
