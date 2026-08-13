interface BrandLogoProps {
  iconSize?: number
  wordmarkClassName?: string
  dark?: boolean
}

export default function BrandLogo({
  iconSize = 34,
  wordmarkClassName = 'text-lg',
  dark = false,
}: BrandLogoProps) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <svg viewBox="0 0 200 200" width={iconSize} height={iconSize} className="shrink-0">
        <defs>
          <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B2E2F" />
            <stop offset="100%" stopColor="#12514F" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2F8F6F" />
            <stop offset="100%" stopColor="#5FDB92" />
          </linearGradient>
          <linearGradient id="leafGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2F8F6F" />
            <stop offset="100%" stopColor="#5FDB92" />
          </linearGradient>
        </defs>
        <rect width="200" height="200" rx="46" fill="url(#badgeGrad)" />
        <g transform="translate(100,100)">
          <path
            d="M -60 -34 A 70 70 0 1 1 -60 34"
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 60 34 A 70 70 0 1 1 60 -34"
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <polygon points="-60,-34 -46,-36 -52,-16" fill="#5FDB92" />
          <polygon points="60,34 46,36 52,16" fill="#2F8F6F" />
          <g transform="translate(0,4) scale(0.72)">
            <path d="M-30,-44 L12,-44 L30,-26 L30,44 L-30,44 Z" fill="#EAF6EF" />
            <path d="M12,-44 L30,-26 L12,-26 Z" fill="#BFE3D6" />
            <line
              x1="-18"
              y1="-14"
              x2="4"
              y2="-14"
              stroke="#0B2E2F"
              strokeWidth="3"
              opacity="0.18"
              strokeLinecap="round"
            />
            <line
              x1="-18"
              y1="-2"
              x2="4"
              y2="-2"
              stroke="#0B2E2F"
              strokeWidth="3"
              opacity="0.18"
              strokeLinecap="round"
            />
            <path
              d="M0,44 C22,44 36,26 30,4 C27,-8 15,-14 4,-8 C0,6 -2,26 0,44 Z"
              fill="url(#leafGrad)"
            />
            <path
              d="M4,36 C10,24 12,10 8,-2"
              stroke="#0B2E2F"
              strokeWidth="1.6"
              opacity="0.3"
              fill="none"
            />
          </g>
        </g>
      </svg>
      <span
        className={`whitespace-nowrap font-heading font-bold ${dark ? 'text-white' : 'text-brand-deep'} ${wordmarkClassName}`}
      >
        SYN<span className="font-semibold text-brand-green">eco</span>
      </span>
    </div>
  )
}
