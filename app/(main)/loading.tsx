export default function Loading() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-muted" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
          <div className="h-8 w-14 rounded-lg bg-muted shrink-0" />
        </div>
      ))}
    </div>
  );
}
