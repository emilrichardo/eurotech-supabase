import { Skeleton, SkeletonLine } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <SkeletonLine width="w-52" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="w-56" />
              <SkeletonLine width="w-32" className="h-2.5" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
