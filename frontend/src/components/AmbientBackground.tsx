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
          <g
            transform="translate(100,100)"
            fill="none"
            stroke="#0B3D3A"
            strokeWidth="11"
            strokeLinecap="round"
          >
            <path d="M -54 10 A 62 62 0 0 1 46 -46" />
            <polygon points="46,-46 60,-30 30,-24" fill="#0B3D3A" stroke="none" />
            <path d="M 54 -10 A 62 62 0 0 1 -46 46" />
            <polygon points="-46,46 -60,30 -30,24" fill="#0B3D3A" stroke="none" />
            <line x1="-30" y1="30" x2="30" y2="-30" strokeWidth="7" opacity="0.85" />
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
