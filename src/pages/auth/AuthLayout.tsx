import type { ReactNode } from "react";
import { CheckCircle2, Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { BrandLockup } from "../../components/brand/BrandLockup";
import { WaveBackground } from "../../components/brand/WaveBackground";

const PANEL_FEATURES = [
  "End-to-end design workflows — brief to publish",
  "Multi-level approvals with a full audit trail",
  "Publishing studio & performance analytics",
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="border-token bg-surface text-muted hover:text-fg absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {dark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

/** Desktop brand panel — always the dark brand gradient (a brand moment). */
function BrandPanel() {
  return (
    <aside
      data-theme="dark"
      aria-label="AWS Community Karachi"
      className="bg-gradient-brand relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden lg:flex xl:w-[46%]"
    >
      <WaveBackground />
      <div
        aria-hidden="true"
        className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-[#6D20E8]/25 blur-3xl"
      />
      <div className="relative z-10 p-10 xl:p-14">
        <BrandLockup />
      </div>
      <div className="relative z-10 p-10 xl:p-14">
        <p className="font-display text-[11px] font-bold tracking-[0.3em] text-lavender">
          CONNECT • LEARN • BUILD • GROW
        </p>
        <h1 className="font-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white xl:text-[3.4rem]">
          AWS Community
          <br />
          <span className="text-gradient-brand">Karachi</span>
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
          Design Operations &amp; Publishing Workspace — where the
          community&rsquo;s designs move from brief to publish.
        </p>
        <ul className="mt-9 space-y-3.5">
          {PANEL_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-white/80">
              <CheckCircle2
                className="mt-0.5 h-4.5 w-4.5 shrink-0 text-lavender"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative z-10 px-10 pb-8 text-xs text-white/40 xl:px-14">
        Internal workspace · Accounts are provisioned by your organizer
      </p>
    </aside>
  );
}

/** Compact brand header for mobile — replaces the side panel below lg. */
function MobileBrandHeader() {
  return (
    <header
      data-theme="dark"
      className="bg-gradient-brand relative overflow-hidden lg:hidden"
    >
      <WaveBackground className="opacity-70" />
      <div className="relative z-10 px-6 pb-7 pt-7">
        <BrandLockup compact />
        <p className="font-display mt-5 text-[10px] font-bold tracking-[0.3em] text-lavender">
          CONNECT • LEARN • BUILD • GROW
        </p>
        <p className="font-display mt-2 text-[22px] font-extrabold tracking-tight text-white">
          AWS Community Karachi
        </p>
        <p className="mt-1 text-[13px] text-white/70">
          Design Operations &amp; Publishing Workspace
        </p>
      </div>
    </header>
  );
}

function AuthFooter() {
  return (
    <footer className="text-subtle relative z-10 px-4 pb-6 text-center text-xs">
      AWS Community Karachi — Design Operations &amp; Publishing Workspace
    </footer>
  );
}

function SplitLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-app text-fg flex min-h-screen">
      <BrandPanel />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <MobileBrandHeader />
        <ThemeToggle />
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md animate-slide-up">
            <h2 className="font-display text-[26px] font-bold tracking-tight">
              {title}
            </h2>
            <p className="text-muted mt-1.5 text-sm">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
        <AuthFooter />
      </main>
    </div>
  );
}

function CenteredLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-app text-fg relative flex min-h-screen flex-col">
      <WaveBackground className="opacity-50" />
      <ThemeToggle />
      <header className="relative z-10 flex justify-center px-4 pt-10">
        <BrandLockup />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="border-token bg-surface w-full max-w-md animate-slide-up rounded-2xl border p-8 shadow-pop sm:p-10">
          <h1 className="font-display text-center text-xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="text-muted mt-1.5 text-center text-sm">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
      <AuthFooter />
    </div>
  );
}

export default function AuthLayout({
  title,
  subtitle,
  children,
  variant = "split",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** "split" = two-panel brand layout (login); "centered" = card on waves. */
  variant?: "split" | "centered";
}) {
  if (variant === "centered") {
    return (
      <CenteredLayout title={title} subtitle={subtitle}>
        {children}
      </CenteredLayout>
    );
  }
  return (
    <SplitLayout title={title} subtitle={subtitle}>
      {children}
    </SplitLayout>
  );
}
