interface AmbientBackgroundProps {
  variant?: 'auth' | 'app'
}

export default function AmbientBackground({ variant = 'app' }: AmbientBackgroundProps) {
  if (variant === 'auth') {
    return (
      <>
        <div
          className="brand-blob"
          style={{
            width: 620,
            height: 620,
            top: -180,
            left: -160,
            background: 'radial-gradient(circle at 30% 30%, var(--green-light), transparent 70%)',
            opacity: 0.55,
            filter: 'blur(70px)',
          }}
        />
        <div
          className="brand-blob"
          style={{
            width: 520,
            height: 520,
            bottom: -200,
            right: -140,
            background: 'radial-gradient(circle at 60% 40%, var(--petrol-mid), transparent 70%)',
            opacity: 0.55,
            filter: 'blur(70px)',
            animationDelay: '-8s',
          }}
        />
        <div
          className="brand-blob"
          style={{
            width: 420,
            height: 420,
            bottom: '10%',
            left: '8%',
            background: 'radial-gradient(circle at 50% 50%, var(--green), transparent 70%)',
            opacity: 0.35,
            filter: 'blur(70px)',
            animationDelay: '-14s',
          }}
        />
        <svg
          viewBox="0 0 200 200"
          className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        >
          <g transform="translate(100,100)">
            <path
              d="M -62 -36 A 72 72 0 1 1 -62 36"
              fill="none"
              stroke="#0B2E2F"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M 62 36 A 72 72 0 1 1 62 -36"
              fill="none"
              stroke="#0B2E2F"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <polygon points="-62,-36 -48,-38 -54,-18" fill="#0B2E2F" />
            <polygon points="62,36 48,38 54,18" fill="#0B2E2F" />
            <path d="M-26,-40 L10,-40 L26,-24 L26,20 L-26,20 Z" fill="#0B2E2F" />
            <path
              d="M-8,20 C-8,44 4,60 22,64 C40,60 46,42 38,26 C32,14 14,8 -8,20 Z"
              fill="#0B2E2F"
            />
          </g>
        </svg>
      </>
    )
  }

  return (
    <>
      <div
        className="brand-blob"
        style={{
          width: 560,
          height: 560,
          top: -220,
          left: -160,
          background: 'radial-gradient(circle, var(--green-light), transparent 70%)',
          opacity: 0.28,
          filter: 'blur(90px)',
          animation: 'none',
        }}
      />
      <div
        className="brand-blob"
        style={{
          width: 460,
          height: 460,
          top: '20%',
          right: -180,
          background: 'radial-gradient(circle, var(--petrol-mid), transparent 70%)',
          opacity: 0.28,
          filter: 'blur(90px)',
          animation: 'none',
        }}
      />
    </>
  )
}
