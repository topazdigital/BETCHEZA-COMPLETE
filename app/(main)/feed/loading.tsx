export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
        <div className="hidden animate-pulse space-y-3 lg:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-xl bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="hidden animate-pulse space-y-3 lg:block">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
