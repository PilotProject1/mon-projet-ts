interface BrandLogoProps {
  iconSize?: number
  wordmarkClassName?: string
}

export default function BrandLogo({ iconSize = 34, wordmarkClassName = 'text-lg' }: BrandLogoProps) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <svg viewBox="0 0 200 200" width={iconSize} height={iconSize} className="shrink-0">
        <defs>
          <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B3D3A" />
            <stop offset="100%" stopColor="#155E52" />
          </linearGradient>
          <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EAF6EF" />
            <stop offset="100%" stopColor="#8FD9B3" />
          </linearGradient>
        </defs>
        <rect width="200" height="200" rx="46" fill="url(#badgeGrad)" />
        <g
          transform="translate(100,100)"
          fill="none"
          stroke="url(#leafGrad)"
          strokeWidth="11"
          strokeLinecap="round"
        >
          <path d="M -54 10 A 62 62 0 0 1 46 -46" />
          <polygon points="46,-46 60,-30 30,-24" fill="#EAF6EF" stroke="none" />
          <path d="M 54 -10 A 62 62 0 0 1 -46 46" />
          <polygon points="-46,46 -60,30 -30,24" fill="#EAF6EF" stroke="none" />
          <line x1="-30" y1="30" x2="30" y2="-30" strokeWidth="7" opacity="0.85" />
        </g>
      </svg>
      <span className={`whitespace-nowrap font-bold text-brand-deep ${wordmarkClassName}`}>
        SYN<span className="font-semibold text-brand-green">eco</span>
      </span>
    </div>
  )
}
