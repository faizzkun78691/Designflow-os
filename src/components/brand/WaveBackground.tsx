/**
 * Signature purple wave decoration for AWS Community Karachi brand moments.
 *
 * 2–4 smooth layered translucent purple ribbons with a narrow bright-violet
 * highlight edge. Positioned at the bottom edge by default; corners optional.
 * Pure SVG — scales cleanly, honors prefers-reduced-motion.
 */
export function WaveBackground({
  className = "",
  variant = "bottom",
  opacity = 1,
}: {
  className?: string;
  variant?: "bottom" | "corner";
  opacity?: number;
}) {
  const position =
    variant === "bottom"
      ? "absolute inset-x-0 bottom-0 h-48 sm:h-64"
      : "absolute -right-16 -top-16 h-64 w-64 sm:h-80 sm:w-80";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden ${position} ${className}`}
      style={{ opacity }}
    >
      <svg
        viewBox="0 0 800 260"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="dfos-wave-1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#351078" stopOpacity="0.0" />
            <stop offset="30%" stopColor="#6D20E8" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#8B35FF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#351078" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="dfos-wave-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1B0D43" stopOpacity="0.0" />
            <stop offset="40%" stopColor="#6D20E8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#1B0D43" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="dfos-wave-hi" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B35FF" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#C8A6FF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8B35FF" stopOpacity="0.0" />
          </linearGradient>
          <filter id="dfos-wave-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Back ribbon */}
        <path
          d="M -40 190 C 140 120, 260 210, 420 160 S 700 120, 840 170 L 840 260 L -40 260 Z"
          fill="url(#dfos-wave-1)"
        />
        {/* Mid ribbon */}
        <path
          d="M -40 215 C 160 150, 300 235, 460 185 S 720 150, 840 195 L 840 260 L -40 260 Z"
          fill="url(#dfos-wave-2)"
          filter="url(#dfos-wave-glow)"
        />
        {/* Narrow bright highlight edge */}
        <path
          d="M -40 188 C 140 118, 260 208, 420 158 S 700 118, 840 168"
          fill="none"
          stroke="url(#dfos-wave-hi)"
          strokeWidth="3"
        />
        {/* Front ribbon */}
        <path
          d="M -40 240 C 180 185, 320 250, 480 210 S 730 180, 840 220 L 840 260 L -40 260 Z"
          fill="url(#dfos-wave-1)"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}
