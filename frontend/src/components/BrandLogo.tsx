import Image from 'next/image'
import Link from 'next/link'

type BrandLogoProps = {
  compact?: boolean
  href?: string | null
  className?: string
}

export default function BrandLogo({ compact = false, href = null, className = '' }: BrandLogoProps) {
  const content = (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#390094_0%,#6A3FB9_58%,#A184CF_100%)] shadow-[0_10px_30px_rgba(57,0,148,0.22)] ring-1 ring-white/60">
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white">E</span>
      </div>
      {!compact && (
        <Image
          src="/eurotech-logo.svg"
          alt="Eurotech"
          width={170}
          height={30}
          priority
          className="h-auto w-[170px] max-w-[46vw]"
        />
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} aria-label="Eurotech Monitor" className="inline-flex">
        {content}
      </Link>
    )
  }

  return content
}
