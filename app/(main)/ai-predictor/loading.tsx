export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-4 max-w-3xl mx-auto">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-4 w-72 rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </div>
            </div>
            <div className="h-4 w-full rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded-lg bg-muted" />
              <div className="h-8 flex-1 rounded-lg bg-muted" />
              <div className="h-8 flex-1 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
