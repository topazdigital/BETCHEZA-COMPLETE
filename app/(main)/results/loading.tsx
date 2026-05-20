export default function Loading() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-full bg-muted" />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
          <div className="h-8 w-16 rounded-lg bg-muted shrink-0" />
        </div>
      ))}
    </div>
  );
}
