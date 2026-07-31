export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 w-full rounded-lg bg-muted" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 w-full rounded-xl bg-muted" />
      ))}
    </div>
  );
}
