import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import type { AppRole, Profile } from "../types";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  /** True while the session or the profile/role row is being resolved. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Invalid email or password. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address before signing in.";
  if (m.includes("user not found"))
    return "No account exists for this email address.";
  if (m.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("password should be"))
    return message;
  return "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadIdentity = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const [{ data: p, error: pErr }, { data: r, error: rErr }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const profile = (p as Profile | null) ?? null;
      // Inactive accounts are signed out immediately.
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        setProfile(null);
        setRole(null);
        setSession(null);
        throw new Error("This account has been deactivated.");
      }
      setProfile(profile);
      setRole(((r as { role: AppRole } | null)?.role ?? null) as AppRole | null);
    } catch (err) {
      // Never log row contents; keep the failure visible in UI state instead.
      console.error("Failed to load user profile/role");
      if (err instanceof Error && err.message === "This account has been deactivated.") {
        throw err;
      }
      setProfile(null);
      setRole(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setSessionLoading(false);
        if (data.session?.user) void loadIdentity(data.session.user.id);
      })
      .catch(() => {
        if (!cancelled) setSessionLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession);
        if (nextSession?.user) {
          void loadIdentity(nextSession.user.id);
        } else {
          setProfile(null);
          setRole(null);
          setProfileLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadIdentity]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(friendlyAuthError(error.message));
    setProfile(null);
    setRole(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadIdentity(session.user.id);
  }, [session, loadIdentity]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      isLoading: sessionLoading || (session !== null && profileLoading),
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [
      session,
      profile,
      role,
      sessionLoading,
      profileLoading,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
