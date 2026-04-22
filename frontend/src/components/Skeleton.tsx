export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
}

export function SkeletonLine({ width = 'w-full', className = '' }: { width?: string; className?: string }) {
  return <div className={`h-3 bg-gray-200 rounded animate-pulse ${width} ${className}`} />
}

export function SkeletonCircle({ size = 'w-8 h-8', className = '' }: { size?: string; className?: string }) {
  return <div className={`${size} rounded-full bg-gray-200 animate-pulse ${className}`} />
}
