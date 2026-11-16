interface OceanLogoProps {
  compact?: boolean;
}

export function OceanLogo({ compact = false }: OceanLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width={compact ? 30 : 36}
        height={compact ? 30 : 36}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="oceanMarkGrad" x1="2" y1="4" x2="38" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#086BFF" />
            <stop offset="55%" stopColor="#18A0FF" />
            <stop offset="100%" stopColor="#60C5FF" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#oceanMarkGrad)" />
        <path
          d="M10 22.5C12.8 18.8 16.5 18.8 19.8 22C23.1 25.2 26.8 25.2 30 21.5"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M10 15.5C12.8 11.8 16.5 11.8 19.8 15C23.1 18.2 26.8 18.2 30 14.5"
          stroke="#ECFCFF"
          strokeOpacity="0.85"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="20" cy="28.5" r="2" fill="#ECFCFF" />
      </svg>
      <span className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-[#086BFF] uppercase">
          Samsung
        </span>
        <span className="text-base font-bold tracking-tight text-slate-900">
          Ocean 3D
        </span>
      </span>
    </span>
  );
}
