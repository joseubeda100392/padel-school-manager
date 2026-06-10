export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-7 w-44 rounded-lg bg-gray-200" />
        <div className="mt-2 h-4 w-72 rounded-lg bg-gray-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="h-10 w-10 rounded-xl bg-gray-200" />
            <div className="mt-4 h-8 w-20 rounded-lg bg-gray-200" />
            <div className="mt-2 h-4 w-32 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-xl bg-white shadow-sm ring-1 ring-gray-100" />
        <div className="h-64 rounded-xl bg-white shadow-sm ring-1 ring-gray-100" />
      </div>
    </div>
  )
}
