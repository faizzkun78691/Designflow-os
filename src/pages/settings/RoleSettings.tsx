import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  LogOut,
  MonitorSmartphone,
  Moon,
  Palette,
  Pencil,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { updateMyProfile, uploadAvatar } from "../../services/profiles";
import { fetchMyReportingManager } from "../../features/settings/services/reporting";
import { roleLabel } from "../../utils/roles";
import { PageHeader } from "../../components/ui/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Avatar } from "../../components/ui/avatar";
import { Skeleton } from "../../components/ui/skeleton";
import { Separator } from "../../components/ui/separator";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { toast } from "../../components/ui/toaster";
import { cn } from "../../utils/cn";

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

type ThemeMode = "system" | "dark" | "light";
const THEME_STORAGE_KEY = "dfos-theme";

function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading settings">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      setMode(stored === "dark" || stored === "light" ? stored : "system");
    } catch {
      setMode("system");
    }
  }, []);

  const apply = (m: ThemeMode) => {
    setMode(m);
    if (m === "system") {
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const prefersLight =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: light)").matches;
      setTheme(prefersLight ? "light" : "dark");
    } else {
      setTheme(m);
    }
  };

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "system", label: "System", icon: MonitorSmartphone },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "light", label: "Light", icon: Sun },
  ];

  return (
    <section aria-label="Appearance">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-volt" aria-hidden="true" />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>
            Choose how DesignFlow OS looks. System follows your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Color theme"
            className="grid grid-cols-3 gap-2"
          >
            {options.map((o) => {
              const active = mode === o.value;
              const Icon = o.icon;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => apply(o.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-colors",
                    active
                      ? "border-volt/60 bg-volt/10 text-volt"
                      : "border-token bg-surface-2 text-muted hover:border-token-strong hover:text-fg",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="text-sm font-semibold">{o.label}</span>
                  <span className="text-[11px] text-subtle">
                    {o.value === "system"
                      ? `Follows device (${theme})`
                      : o.value === "dark"
                        ? "Midnight indigo"
                        : "Cloud white"}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function RoleSettings() {
  const navigate = useNavigate();
  const { user, profile, role, isLoading, signOut, updatePassword, refreshProfile } =
    useAuth();

  const uid = user?.id ?? null;

  // ---- Reporting manager -------------------------------------------------
  const reportingManager = useQuery({
    queryKey: ["settings", "reporting-manager", uid],
    queryFn: async () => {
      if (!uid) throw new Error("You must be signed in.");
      return fetchMyReportingManager(uid);
    },
    enabled: uid !== null,
  });

  // ---- Avatar upload ------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleAvatarFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uid) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(uid, file);
      await updateMyProfile(uid, { avatar_url: url });
      await refreshProfile();
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  // ---- Full name inline edit ----------------------------------------------
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  async function handleSaveName(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!uid) return;
    const trimmed = nameValue.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty.");
      return;
    }
    setSavingName(true);
    try {
      await updateMyProfile(uid, { full_name: trimmed });
      await refreshProfile();
      setEditingName(false);
      toast.success("Name updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update name.");
    } finally {
      setSavingName(false);
    }
  }

  // ---- Password change ------------------------------------------------------
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function handlePasswordChange(values: PasswordFormValues): Promise<void> {
    try {
      await updatePassword(values.newPassword);
      reset();
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    }
  }

  // ---- Sign out -------------------------------------------------------------
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

  async function handleSignOut(): Promise<void> {
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out.");
    }
  }

  // ---- Render states ----------------------------------------------------------
  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <SettingsSkeleton />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader title="Settings" />
        <Card className="mt-6 border-[var(--error)]">
          <CardContent className="flex flex-col items-start gap-4 py-8">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className="h-6 w-6 text-[var(--error)]"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-fg">
                  We could not load your profile.
                </p>
                <p className="text-sm text-muted">
                  Check your connection and try again.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void refreshProfile()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const managerName = reportingManager.data?.full_name ?? "—";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, appearance and account."
      />

      {/* Profile card */}
      <section aria-label="Profile">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-volt" aria-hidden="true" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>
              Your public identity across DesignFlow OS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar
                  src={profile.avatar_url}
                  name={profile.full_name}
                  size="lg"
                />
                <button
                  type="button"
                  aria-label="Change profile picture"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-token bg-surface-elev text-muted shadow-pop transition hover:text-volt disabled:opacity-60"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => void handleAvatarFile(e)}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-fg">
                  {uploadingAvatar ? "Uploading…" : "Profile picture"}
                </p>
                <p className="text-xs text-muted">
                  PNG, JPEG or WebP, up to 2 MB.
                </p>
              </div>
            </div>

            <Separator />

            {/* Full name inline edit */}
            <div>
              <Label htmlFor="full-name">Full name</Label>
              {editingName ? (
                <form
                  onSubmit={(e) => void handleSaveName(e)}
                  className="mt-2 flex flex-col gap-2 sm:flex-row"
                >
                  <Input
                    id="full-name"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    placeholder="Your full name"
                    disabled={savingName}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={savingName}>
                      {savingName ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={savingName}
                      onClick={() => {
                        setEditingName(false);
                        setNameValue(profile.full_name);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="text-sm text-fg">{profile.full_name}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNameValue(profile.full_name);
                      setEditingName(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Read-only details */}
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Email
                </dt>
                <dd className="mt-1 truncate text-sm text-fg">
                  {profile.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Designation
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  {profile.designation ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  System role
                </dt>
                <dd className="mt-1">
                  <Badge variant="outline">{roleLabel(role)}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Reporting manager
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  {reportingManager.isLoading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    managerName
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Account status
                </dt>
                <dd className="mt-1">
                  <Badge variant={profile.is_active ? "success" : "muted"}>
                    {profile.is_active ? "Active" : "Inactive"}
                  </Badge>
                </dd>
              </div>
            </dl>

            <p className="rounded-xl border border-token bg-surface-2 px-4 py-3 text-xs text-muted">
              Role, designation and reporting manager are managed by your
              organizer — you cannot change them here.
            </p>
          </CardContent>
        </Card>
      </section>

      <AppearanceCard />

      {/* Notifications card */}
      <section aria-label="Notifications">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-volt" aria-hidden="true" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>
              Real-time task notifications are always on for your role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-fg">
                  Realtime notifications
                </p>
                <p className="text-xs text-muted">
                  Task assignments, approvals, revisions and publishing updates
                  appear instantly. Open the bell icon in the top bar to view,
                  read and clear them.
                </p>
              </div>
              <Badge variant="success">On</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Security card */}
      <section aria-label="Security">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-volt" aria-hidden="true" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Change your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((values) => handlePasswordChange(values))}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  disabled={isSubmitting}
                  aria-describedby={
                    errors.newPassword ? "new-password-error" : undefined
                  }
                  aria-invalid={!!errors.newPassword}
                  {...register("newPassword")}
                />
                {errors.newPassword && (
                  <p
                    id="new-password-error"
                    className="text-xs text-[var(--error)]"
                    role="alert"
                  >
                    {errors.newPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your new password"
                  disabled={isSubmitting}
                  aria-describedby={
                    errors.confirmPassword ? "confirm-password-error" : undefined
                  }
                  aria-invalid={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p
                    id="confirm-password-error"
                    className="text-xs text-[var(--error)]"
                    role="alert"
                  >
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Session card */}
      <section aria-label="Session">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MonitorSmartphone
                className="h-5 w-5 text-volt"
                aria-hidden="true"
              />
              <CardTitle>Session</CardTitle>
            </div>
            <CardDescription>
              Sign out of DesignFlow OS on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setConfirmSignOutOpen(true)}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out of this device
            </Button>
          </CardContent>
        </Card>
      </section>

      <ConfirmDialog
        open={confirmSignOutOpen}
        onOpenChange={setConfirmSignOutOpen}
        title="Sign out?"
        description="You will be signed out of DesignFlow OS on this device."
        confirmLabel="Sign out"
        onConfirm={() => void handleSignOut()}
      />
    </main>
  );
}
