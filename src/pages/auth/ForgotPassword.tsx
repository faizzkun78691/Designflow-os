import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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

const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values: ForgotForm) => {
    setSubmitError(null);
    try {
      await sendPasswordReset(values.email);
      setSentTo(values.email);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <AuthLayout
      variant="centered"
      title="Reset your password"
      subtitle="We will email you a reset link"
    >
      {sentTo ? (
        <div className="text-center" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-volt" aria-hidden="true" />
          <h2 className="font-display mt-4 text-lg font-bold">Check your inbox</h2>
          <p className="text-muted mt-2 text-sm">
            If an account exists for{" "}
            <span className="font-medium text-[var(--fg)]">{sentTo}</span>, a password
            reset link is on its way. The link expires in 1 hour.
          </p>
          <Button asChild className="font-display mt-6 h-12 w-full text-[15px] font-bold">
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

          <div>
            <Label htmlFor="forgot-email" className={labelClass}>
              Email
            </Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "forgot-email-error" : undefined}
              className={inputClass}
              {...register("email")}
            />
            {errors.email && (
              <p id="forgot-email-error" role="alert" className={fieldErrorClass}>
                {errors.email.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="font-display mt-6 h-12 w-full text-[15px] font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending link…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>

          <p className="text-muted mt-6 text-center text-sm">
            Remembered it?{" "}
            <Link
              to="/login"
              className="rounded font-semibold text-volt hover:text-volt-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
