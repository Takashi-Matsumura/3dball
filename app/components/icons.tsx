// Shared SVG icon components. Keep these as thin wrappers — no state, no logic.
// Every icon accepts `className` for sizing/color via Tailwind.

type IconProps = { className?: string };

const STROKE_COMMON = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// ── General ──────────────────────────────────────────────────────────

export function IconBall({ className = "w-10 h-10" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={1.5} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10" />
      <path d="M12 2a15 15 0 0 0-4 10 15 15 0 0 0 4 10" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function IconGamepad({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h4M8 10v4" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <circle cx="18" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconListOrdered({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M3 14h2l-2 2h2" />
    </svg>
  );
}

export function IconRepeat({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function IconGitBranch({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

export function IconKeyboard({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h0M10 8h0M14 8h0M18 8h0M8 12h0M12 12h0M16 12h0M8 16h8" />
    </svg>
  );
}

export function IconCard({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 15h0M2 9.5h20" />
    </svg>
  );
}

export function IconCode({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export function IconArrowLeft({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconSparkles({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z" />
    </svg>
  );
}

export function IconTarget({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function IconLightbulb({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.8c.7.5 1 1.3 1 2.2v1h6v-1c0-.9.3-1.7 1-2.2A7 7 0 0 0 12 2z" />
    </svg>
  );
}

// ── Status / controls ────────────────────────────────────────────────

export function IconCheck({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={3} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconX({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconRefresh({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2.5} className={className}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export function IconSpinner({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2.5} className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function IconPlay({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

export function IconSettings({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconCardReader({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={2} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M12 12h.01" />
      <path d="M17 12h.01" />
      <path d="M7 12h.01" />
    </svg>
  );
}

export function IconSave({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...STROKE_COMMON} strokeWidth={1.5} className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

// ── Collapsible chevron (rotates when open) ─────────────────────────

export function IconChevron({ open, className = "w-5 h-5" }: IconProps & { open: boolean }) {
  return (
    <svg
      {...STROKE_COMMON}
      strokeWidth={2}
      className={`${className} transition-transform duration-200 ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
