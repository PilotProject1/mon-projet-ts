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
        <g transform="translate(100,100)">
          <path
            d="M26,-58 C-8,-66 -50,-46 -58,-10 C-64,16 -50,38 -28,50"
            fill="none"
            stroke="url(#leafGrad)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M-26,58 C8,66 50,46 58,10 C64,-16 50,-38 28,-50"
            fill="none"
            stroke="url(#leafGrad)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <g transform="translate(26,-58) rotate(-25)">
            <path
              d="M0,0 C14,-2 24,-14 22,-28 C21,-34 16,-38 10,-36 C2,-34 -4,-24 -2,-12 C-1,-6 0,-2 0,0 Z"
              fill="#EAF6EF"
            />
          </g>
          <g transform="translate(-26,58) rotate(155)">
            <path
              d="M0,0 C14,-2 24,-14 22,-28 C21,-34 16,-38 10,-36 C2,-34 -4,-24 -2,-12 C-1,-6 0,-2 0,0 Z"
              fill="#EAF6EF"
            />
          </g>
        </g>
      </svg>
      <span className={`whitespace-nowrap font-bold text-brand-deep ${wordmarkClassName}`}>
        SYN<span className="font-semibold text-brand-green">eco</span>
      </span>
    </div>
  )
}
