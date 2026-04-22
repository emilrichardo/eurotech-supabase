import { Skeleton, SkeletonLine } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <SkeletonLine width="w-24" />
          <div className="flex items-center gap-4 pt-1">
            <SkeletonLine width="w-40" className="h-2.5" />
            <SkeletonLine width="w-40" className="h-2.5" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <div className="ml-auto flex gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="p-3 space-y-2">
              <SkeletonLine width="w-full" />
              <SkeletonLine width="w-3/4" />
              <SkeletonLine width="w-16" className="h-2.5 mt-1" />
              <div className="flex items-center justify-between pt-1">
                <SkeletonLine width="w-20" className="h-4" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
