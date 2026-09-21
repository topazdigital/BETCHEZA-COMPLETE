export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-4 sm:p-6">
      <div className="h-8 w-64 rounded-lg bg-muted" />
      <div className="h-4 w-full max-w-2xl rounded bg-muted/70" />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="h-32 rounded-xl border border-border bg-card" />
        <div className="h-32 rounded-xl border border-border bg-card" />
        <div className="h-32 rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}
