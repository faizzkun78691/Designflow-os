import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { isSupabaseConfigured } from "../integrations/supabase/client";
import type { AppRole } from "../types";

export function FullScreenSpinner() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink text-white"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-volt" aria-hidden="true" />
      <p className="text-sm text-white/60">Loading…</p>
    </div>
  );
}

export function PendingSetupPanel() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md rounded-xl border border-token bg-panel p-8 text-center shadow-card">
        <ShieldAlert
          className="mx-auto h-12 w-12 text-volt"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-xl font-semibold text-white">
          Account pending setup
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Your account has no system role yet. Please contact your organizer.
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-volt px-4 py-2.5 text-sm font-semibold text-volt-ink transition hover:bg-volt-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();

  if (!isSupabaseConfigured()) {
    return <Navigate to="/config-error" replace />;
  }
  if (isLoading) {
    return <FullScreenSpinner />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function RoleGuard({
  allowed,
  children,
}: {
  allowed: AppRole[];
  children: ReactNode;
}) {
  const { session, role, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenSpinner />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (role === null) {
    return <PendingSetupPanel />;
  }
  if (!allowed.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
