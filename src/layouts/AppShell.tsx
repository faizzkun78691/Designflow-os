import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ROLE_SETTINGS, roleLabel } from "../utils/roles";
import { Avatar } from "../components/ui/avatar";
import { BrandLockup } from "../components/brand/BrandLockup";
import { NotificationsBell } from "../features/notifications/NotificationsBell";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface AppShellProps {
  navItems: NavItem[];
  sectionLabel: string;
  children: ReactNode;
}

export function AppShell({ navItems, sectionLabel, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  // Lock body scroll + close on Escape while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const settingsPath = role ? ROLE_SETTINGS[role] : "/login";
  const displayName =
    profile?.full_name?.trim() || profile?.email || "Account";

  // Current page label for the topbar breadcrumb.
  const currentPageLabel = useMemo(() => {
    const path = location.pathname;
    let best: NavItem | null = null;
    for (const item of navItems) {
      const matches = item.end
        ? path === item.to
        : path === item.to || path.startsWith(`${item.to}/`);
      if (matches && (!best || item.to.length > best.to.length)) {
        best = item;
      }
    }
    return best?.label ?? null;
  }, [location.pathname, navItems]);

  const renderNav = (isCollapsed: boolean, closeMobile?: () => void) => (
    <nav aria-label={`${sectionLabel} navigation`} className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={closeMobile}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "font-display relative flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-[13px] font-semibold tracking-wide transition-colors",
                isActive
                  ? "text-white shadow-glow"
                  : "text-muted hover:bg-[var(--surface-2)] hover:text-fg",
              )
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background:
                      "linear-gradient(135deg, var(--primary) 0%, var(--ring) 100%)",
                  }
                : undefined
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white transition-opacity",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon
                  className="size-5 shrink-0"
                  aria-hidden="true"
                  strokeWidth={isActive ? 2.25 : 2}
                />
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const profileMenu = (
    <DropdownMenu
      label="Account"
      align="end"
      side="bottom"
      trigger={
        <span className="flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-1 pl-1 pr-2.5 transition-colors hover:border-[var(--border-strong)]">
          <Avatar src={profile?.avatar_url} name={displayName} size="sm" />
          <span className="hidden min-w-0 max-w-[10rem] text-left lg:block">
            <span className="font-display block truncate text-[13px] font-semibold text-fg">
              {displayName}
            </span>
            <span className="block truncate text-[11px] text-subtle">
              {roleLabel(role)}
            </span>
          </span>
        </span>
      }
    >
      <DropdownMenuLabel>
        <span className="block truncate normal-case tracking-normal text-subtle">
          {displayName}
        </span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem icon={Settings} onSelect={() => navigate(settingsPath)}>
        Settings
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={LogOut}
        danger
        onSelect={() => {
          void handleSignOut();
        }}
      >
        Log out
      </DropdownMenuItem>
    </DropdownMenu>
  );

  const sidebarMotion = reduceMotion
    ? {}
    : {
        initial: false,
        animate: { width: collapsed ? 76 : 264 },
        transition: { type: "spring" as const, stiffness: 320, damping: 32 },
      };

  return (
    <div className="flex min-h-dvh bg-[var(--bg)] text-fg">
      {/* Desktop sidebar */}
      <motion.aside
        {...sidebarMotion}
        style={collapsed ? { width: 76 } : { width: 264 }}
        className="sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] md:flex"
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4",
            collapsed && "justify-center px-2",
          )}
        >
          <BrandLockup compact={collapsed} />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          {renderNav(collapsed)}
        </div>

        <div className="shrink-0 border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "font-display flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5 shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-5 shrink-0" aria-hidden="true" />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
          {!collapsed && (
            <p className="font-display mt-3 px-1 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-subtle">
              Connect · Learn · Build · Grow
            </p>
          )}
        </div>
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm md:hidden"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`${sectionLabel} navigation`}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      type: "tween",
                      duration: 0.25,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--surface)] md:hidden"
            >
              <div className="safe-top">
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
                  <BrandLockup />
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close navigation"
                    className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-fg"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {renderNav(false, () => setMobileOpen(false))}
              </div>
              <div className="safe-bottom shrink-0 border-t border-[var(--border)] p-4">
                <p className="font-display text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-subtle">
                  AWS Community Karachi
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="safe-top sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-fg md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            {/* Breadcrumb / page title */}
            <div className="min-w-0 flex-1">
              <p className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-subtle sm:block">
                {sectionLabel}
              </p>
              <h1 className="font-display truncate text-base font-bold tracking-tight text-fg sm:text-lg">
                {currentPageLabel ?? sectionLabel}
              </h1>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-fg"
              >
                {theme === "dark" ? (
                  <Sun className="size-5" aria-hidden="true" />
                ) : (
                  <Moon className="size-5" aria-hidden="true" />
                )}
              </button>
              <NotificationsBell />
              {profileMenu}
            </div>
          </div>
        </div>
        <main className="min-w-0 flex-1">
          <div className="safe-bottom mx-auto w-full max-w-[1400px] animate-fade-in overflow-x-hidden px-4 py-4 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
