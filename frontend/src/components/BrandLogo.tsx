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
      {dark ? (
        <svg viewBox="0 0 200 200" width={iconSize} height={iconSize} className="shrink-0">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2F8F6F" />
              <stop offset="100%" stopColor="#5FDB92" />
            </linearGradient>
            <linearGradient id="leafGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2F8F6F" />
              <stop offset="100%" stopColor="#5FDB92" />
            </linearGradient>
          </defs>
          <g transform="translate(100,100)">
            <path
              d="M -62 -36 A 72 72 0 1 1 -62 36"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M 62 36 A 72 72 0 1 1 62 -36"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <polygon points="-62,-36 -48,-38 -54,-18" fill="#5FDB92" />
            <polygon points="62,36 48,38 54,18" fill="#2F8F6F" />
            <path d="M-26,-40 L10,-40 L26,-24 L26,20 L-26,20 Z" fill="#EAF6EF" />
            <path d="M10,-40 L26,-24 L10,-24 Z" fill="#BFE3D6" />
            <line
              x1="-16"
              y1="-12"
              x2="6"
              y2="-12"
              stroke="#0B2E2F"
              strokeWidth="2.6"
              opacity="0.25"
              strokeLinecap="round"
            />
            <line
              x1="-16"
              y1="-2"
              x2="6"
              y2="-2"
              stroke="#0B2E2F"
              strokeWidth="2.6"
              opacity="0.25"
              strokeLinecap="round"
            />
            <path
              d="M-8,20 C-8,44 4,60 22,64 C40,60 46,42 38,26 C32,14 14,8 -8,20 Z"
              fill="url(#leafGrad)"
            />
            <path
              d="M0,26 C8,36 12,48 14,58"
              stroke="#0B2E2F"
              strokeWidth="1.6"
              opacity="0.35"
              fill="none"
            />
          </g>
        </svg>
      ) : (
        <img
          src="/syneco-logo.png"
          alt="SYNeco"
          width={iconSize}
          height={iconSize}
          className="shrink-0 object-contain"
          style={{ width: iconSize, height: iconSize }}
        />
      )}
      <span
        className={`whitespace-nowrap font-heading font-bold ${dark ? 'text-white' : 'text-brand-deep'} ${wordmarkClassName}`}
      >
        SYN<span className="font-semibold text-brand-green">eco</span>
      </span>
    </div>
  )
}
