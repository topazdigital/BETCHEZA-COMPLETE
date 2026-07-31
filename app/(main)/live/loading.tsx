export default function Loading() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-6 w-24 rounded-lg bg-muted" />
        <div className="h-5 w-8 rounded bg-muted" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-20 w-full rounded-xl bg-muted" />
      ))}
    </div>
  );
}
