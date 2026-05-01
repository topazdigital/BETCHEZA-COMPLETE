export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-3 p-4">
      <div className="h-10 w-full rounded-lg bg-muted" />
      <div className="h-8 w-48 rounded-lg bg-muted" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 w-full rounded-xl bg-muted" />
      ))}
    </div>
  );
}
