export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-48 rounded-md bg-muted animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl border bg-card animate-pulse" />
        ))}
      </div>
    </div>
  );
}
