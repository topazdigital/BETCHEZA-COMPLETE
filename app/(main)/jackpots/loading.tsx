export default function Loading() {
  return (
    <div className="animate-pulse space-y-3 p-4 max-w-3xl mx-auto">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-4 w-64 rounded bg-muted" />
      <div className="flex gap-2 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-muted" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="h-10 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-9 w-full rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}
