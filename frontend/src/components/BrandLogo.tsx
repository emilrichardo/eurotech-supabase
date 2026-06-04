import Image from 'next/image'
import Link from 'next/link'

type BrandLogoProps = {
  href?: string | null
  className?: string
}

export default function BrandLogo({ href = null, className = '' }: BrandLogoProps) {
  const content = (
    <Image
      src="/eurotech-logo.svg"
      alt="Eurotech"
      width={105}
      height={28}
      priority
      className={`h-auto w-[105px] max-w-[36vw] ${className}`}
    />
  )

  if (href) {
    return (
      <Link href={href} aria-label="Eurotech" className="inline-flex">
        {content}
      </Link>
    )
  }

  return content
}
