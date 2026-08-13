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
              d="M -60 -34 A 70 70 0 1 1 -60 34"
              fill="none"
              stroke="#0B2E2F"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 60 34 A 70 70 0 1 1 60 -34"
              fill="none"
              stroke="#0B2E2F"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <polygon points="-60,-34 -46,-36 -52,-16" fill="#0B2E2F" />
            <polygon points="60,34 46,36 52,16" fill="#0B2E2F" />
            <g transform="translate(0,4) scale(0.72)">
              <path d="M-30,-44 L12,-44 L30,-26 L30,44 L-30,44 Z" fill="#0B2E2F" />
              <path
                d="M0,44 C22,44 36,26 30,4 C27,-8 15,-14 4,-8 C0,6 -2,26 0,44 Z"
                fill="#0B2E2F"
              />
            </g>
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
