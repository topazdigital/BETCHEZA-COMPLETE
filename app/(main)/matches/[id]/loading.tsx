export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="rounded-xl bg-muted h-40 w-full" />
      <div className="flex gap-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-8 w-20 rounded-full bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-32 rounded-xl bg-muted" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 w-full rounded-xl bg-muted" />
      ))}
    </div>
  );
}
