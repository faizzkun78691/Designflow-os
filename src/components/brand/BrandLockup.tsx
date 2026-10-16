/**
 * Brand lockup for AWS Community Karachi.
 *
 * Uses the official AWS logo artwork (standard on light theme,
 * reverse/white on dark theme per AWS brand guidelines) alongside
 * the community wordmark.
 */
import { useTheme } from "../../contexts/ThemeContext";

export function BrandLockup({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/aws-logo-white.svg" : "/aws-logo.svg";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={logoSrc}
        alt="AWS"
        className="shrink-0"
        style={{ height: compact ? 22 : 30, width: "auto" }}
        draggable={false}
      />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="font-display truncate text-[13px] font-800 font-bold tracking-wide text-fg">
            AWS COMMUNITY
          </p>
          <p className="font-display truncate text-[11px] font-semibold tracking-[0.18em] text-muted">
            KARACHI
          </p>
        </div>
      )}
    </div>
  );
}
