export default function Loading() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="flex justify-center gap-8 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 w-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-lg bg-muted" />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-12 w-full rounded-xl bg-muted" />
      ))}
    </div>
  );
}
