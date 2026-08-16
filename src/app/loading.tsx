export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-40 rounded-md bg-muted" />
      <div className="h-24 rounded-xl border bg-card" />
      <div className="h-24 rounded-xl border bg-card" />
    </div>
  );
}
