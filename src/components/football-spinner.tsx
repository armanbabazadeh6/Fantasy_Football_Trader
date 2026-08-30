import { cn } from "@/lib/utils";

export function FootballSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("animate-spiral", className)} aria-hidden="true">
      <ellipse cx="32" cy="32" rx="26" ry="16" transform="rotate(-24 32 32)" fill="#a3e635" />
      <g
        stroke="#020617"
        strokeWidth="3"
        strokeLinecap="round"
        transform="rotate(-24 32 32)"
      >
        <path d="M27 30 L31 34" />
        <path d="M31 30 L27 34" />
        <path d="M33 30 L37 34" />
        <path d="M37 30 L33 34" />
        <path d="M29 26 L35 32" opacity="0" />
      </g>
      <path
        d="M27 27 L37 37"
        stroke="#020617"
        strokeWidth="3"
        strokeLinecap="round"
        transform="rotate(-24 32 32)"
      />
    </svg>
  );
}
