import { Skeleton, SkeletonLine } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-7 w-40" />
        <SkeletonLine width="w-56" className="mt-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="w-1.5 h-1.5 rounded-full" />
              <SkeletonLine width="w-24" />
            </div>
            <Skeleton className="h-8 w-20 mt-1" />
            <SkeletonLine width="w-28" className="mt-3" />
          </div>
        ))}
      </div>

      <div>
        <SkeletonLine width="w-40" className="mb-3 h-2.5" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
              <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonLine width="w-40" />
                <SkeletonLine width="w-32" className="h-2" />
              </div>
              <SkeletonLine width="w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
