import { Skeleton, SkeletonLine } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <SkeletonLine width="w-72" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-3">
            <SkeletonLine width="w-20" className="h-2.5 mb-2" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 border-l-4 rounded-xl p-4 flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="w-3/4" />
              <SkeletonLine width="w-1/2" className="h-2.5" />
              <SkeletonLine width="w-40" className="h-2.5" />
            </div>
            <div className="text-right space-y-2 shrink-0">
              <SkeletonLine width="w-20" className="ml-auto" />
              <SkeletonLine width="w-14" className="ml-auto h-2.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
