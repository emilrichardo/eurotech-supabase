import { Skeleton, SkeletonLine } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <SkeletonLine width="w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="w-2/3" />
              <SkeletonLine width="w-1/3" className="h-2.5" />
            </div>
            <SkeletonLine width="w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
