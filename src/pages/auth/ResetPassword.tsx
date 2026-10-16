import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import AuthLayout from "./AuthLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const labelClass =
  "font-display text-[13px] font-semibold tracking-wide text-[var(--fg)]";
const inputClass =
  "mt-1.5 h-11 border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] hover:border-[var(--border-strong)]";
const fieldErrorClass = "mt-1.5 text-xs text-[var(--error)]";
const errorBannerClass =
  "mb-5 flex items-start gap-2.5 rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]";

const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string().min(1, "Please confirm your new password."),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const { session, updatePassword, signOut } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (values: ResetForm) => {
    setSubmitError(null);
    try {
      await updatePassword(values.password);
      setDone(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  const handleBack = async () => {
    try {
      await signOut();
    } catch {
      /* sign-out best-effort; login page is public anyway */
    }
  };

  return (
    <AuthLayout
      variant="centered"
      title="Set a new password"
      subtitle="Choose a strong password"
    >
      {!session && !done ? (
        <div className="text-center" role="alert">
          <AlertCircle className="mx-auto h-12 w-12 text-[var(--error)]" aria-hidden="true" />
          <h2 className="font-display mt-4 text-lg font-bold">Reset link not available</h2>
          <p className="text-muted mt-2 text-sm">
            This reset link is invalid or expired. Request a new one.
          </p>
          <Button asChild className="font-display mt-6 h-12 w-full text-[15px] font-bold">
            <Link to="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
      ) : done ? (
        <div className="text-center" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-volt" aria-hidden="true" />
          <h2 className="font-display mt-4 text-lg font-bold">Password updated</h2>
          <p className="text-muted mt-2 text-sm">
            Your password has been changed successfully.
          </p>
          <Button
            asChild
            className="font-display mt-6 h-12 w-full text-[15px] font-bold"
            onClick={() => void handleBack()}
          >
            <Link to="/login">Back to sign in</Link>
          </Button>
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
              <Label htmlFor="reset-password" className={labelClass}>
                New password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "reset-password-error" : undefined}
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
                <p id="reset-password-error" role="alert" className={fieldErrorClass}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reset-confirm" className={labelClass}>
                Confirm password
              </Label>
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your new password"
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? "reset-confirm-error" : undefined}
                className={inputClass}
                {...register("confirm")}
              />
              {errors.confirm && (
                <p id="reset-confirm-error" role="alert" className={fieldErrorClass}>
                  {errors.confirm.message}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="font-display mt-6 h-12 w-full text-[15px] font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
