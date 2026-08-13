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
      <img
        src="/syneco-logo.png"
        alt="SYNeco"
        width={iconSize}
        height={iconSize}
        className="shrink-0 object-contain"
        style={{ width: iconSize, height: iconSize }}
      />
      <span
        className={`whitespace-nowrap font-heading font-bold ${dark ? 'text-white' : 'text-brand-deep'} ${wordmarkClassName}`}
      >
        SYN<span className="font-semibold text-brand-green">eco</span>
      </span>
    </div>
  )
}
