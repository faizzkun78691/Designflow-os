import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import AuthLayout from "./AuthLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

/**
 * Theme-aware field styling. The base Input/Label components are still
 * dark-styled; these className overrides (merged last via cn/tailwind-merge)
 * make auth forms readable in both dark and light themes.
 */
const labelClass =
  "font-display text-[13px] font-semibold tracking-wide text-[var(--fg)]";
const inputClass =
  "mt-1.5 h-11 border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] hover:border-[var(--border-strong)]";
const fieldErrorClass = "mt-1.5 text-xs text-[var(--error)]";
const errorBannerClass =
  "mb-5 flex items-start gap-2.5 rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required.")
    .regex(/^[a-z0-9]{3,30}$/, "Usernames are 3-30 lowercase letters/digits."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type LoginForm = z.infer<typeof loginSchema>;

/** Internal auth email pattern for username-based accounts. */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@designflow.internal`;
}

export default function Login() {
  const { session, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (session) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: LoginForm) => {
    setSubmitError(null);
    try {
      await signIn(usernameToEmail(values.username), values.password);
      navigate("/", { replace: true });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <AuthLayout title="Sign in to your workspace" subtitle="Welcome back">
      {isLoading ? (
        <div className="flex items-center justify-center py-8" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-volt" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
          {submitError && (
            <div role="alert" className={errorBannerClass}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <Label htmlFor="login-username" className={labelClass}>
                Username
              </Label>
              <Input
                id="login-username"
                type="text"
                autoComplete="username"
                placeholder="e.g. faizz"
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? "login-username-error" : undefined}
                className={inputClass}
                {...register("username")}
              />
              {errors.username && (
                <p id="login-username-error" role="alert" className={fieldErrorClass}>
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className={labelClass}>
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="rounded py-1 text-xs font-semibold text-volt hover:text-volt-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                  className={`${inputClass} mt-0 pr-12`}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-r-lg text-[var(--fg-subtle)] transition hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="login-password-error" role="alert" className={fieldErrorClass}>
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="font-display mt-7 h-12 w-full text-[15px] font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      )}

      <p className="text-subtle mt-8 text-center text-xs leading-relaxed">
        Accounts are created by your organizer — no public signup.
      </p>
    </AuthLayout>
  );
}
