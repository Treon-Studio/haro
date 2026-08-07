import { memo } from "react";

export const SparklesIcon = memo(function SparklesIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Sparkles"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
});

export const Columns2Icon = memo(function Columns2Icon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Columns"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="12" x2="12" y1="3" y2="21" />
    </svg>
  );
});

export const Rows3Icon = memo(function Rows3Icon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Rows"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="3" x2="21" y1="9" y2="9" />
      <line x1="3" x2="21" y1="15" y2="15" />
    </svg>
  );
});

export const CircleDashedIcon = memo(function CircleDashedIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Circle Dashed"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
    </svg>
  );
});

export const CircleDotIcon = memo(function CircleDotIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Circle Dot"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
});

export const CircleArrowUpIcon = memo(function CircleArrowUpIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Circle Arrow Up"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m16 12-4-4-4 4" />
      <path d="M12 8v8" />
    </svg>
  );
});

export const SquareIcon = memo(function SquareIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Square"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  );
});

export const SquareTerminalIcon = memo(function SquareTerminalIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Square Terminal"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m7 10 4 4-4 4" />
      <path d="M13 14h4" />
    </svg>
  );
});

export const OctagonIcon = memo(function OctagonIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Octagon"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    </svg>
  );
});

export const OctagonXIcon = memo(function OctagonXIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Octagon X"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="2" x2="22" y1="2" y2="22" />
      <line x1="22" x2="2" y1="2" y2="22" />
    </svg>
  );
});

export const ClockFadingIcon = memo(function ClockFadingIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Clock Fading"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
});

export const PanelLeftCloseIcon = memo(function PanelLeftCloseIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Panel Left Close"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="9" x2="9" y1="3" y2="21" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
});

export const PanelLeftOpenIcon = memo(function PanelLeftOpenIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Panel Left Open"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="9" x2="9" y1="3" y2="21" />
      <path d="m15 9-3-3-3 3" />
    </svg>
  );
});

export const PanelRightOpenIcon = memo(function PanelRightOpenIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Panel Right Open"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="15" x2="15" y1="3" y2="21" />
      <path d="m9 9 3 3-3 3" />
    </svg>
  );
});

export const DoorClosedIcon = memo(function DoorClosedIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Door Closed"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
      <path d="M2 20h20" />
      <path d="M14 12v.01" />
    </svg>
  );
});

export const DoorOpenIcon = memo(function DoorOpenIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Door Open"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h3" />
      <path d="M13 20h9" />
      <path d="M10 12v.01" />
      <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />
    </svg>
  );
});

export const BookOpenTextIcon = memo(function BookOpenTextIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Book Open Text"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      <path d="M6 8h2" />
      <path d="M6 12h2" />
      <path d="M16 8h2" />
      <path d="M16 12h2" />
    </svg>
  );
});

export const FingerprintIcon = memo(function FingerprintIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="Fingerprint"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
      <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2" />
    </svg>
  );
});

export const UserMinusIcon = memo(function UserMinusIcon(
  props: React.SVGProps<SVGSVGElement> & { size?: string | number },
) {
  return (
    <svg
      role="img"
      aria-label="User Minus"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
});
