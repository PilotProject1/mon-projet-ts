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
              d="M26,-58 C-8,-66 -50,-46 -58,-10 C-64,16 -50,38 -28,50"
              fill="none"
              stroke="#0B3D3A"
              strokeWidth="13"
              strokeLinecap="round"
            />
            <path
              d="M-26,58 C8,66 50,46 58,10 C64,-16 50,-38 28,-50"
              fill="none"
              stroke="#0B3D3A"
              strokeWidth="13"
              strokeLinecap="round"
            />
            <g transform="translate(26,-58) rotate(-25)">
              <path
                d="M0,0 C14,-2 24,-14 22,-28 C21,-34 16,-38 10,-36 C2,-34 -4,-24 -2,-12 C-1,-6 0,-2 0,0 Z"
                fill="#0B3D3A"
              />
            </g>
            <g transform="translate(-26,58) rotate(155)">
              <path
                d="M0,0 C14,-2 24,-14 22,-28 C21,-34 16,-38 10,-36 C2,-34 -4,-24 -2,-12 C-1,-6 0,-2 0,0 Z"
                fill="#0B3D3A"
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
