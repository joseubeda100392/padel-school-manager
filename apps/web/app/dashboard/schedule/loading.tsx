export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="h-7 w-44 rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-72 rounded-lg bg-gray-200" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-gray-200" />
      </div>
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="border-b border-gray-100 p-4">
          <div className="h-9 w-64 rounded-lg bg-gray-200" />
        </div>
        <div className="space-y-3 p-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
