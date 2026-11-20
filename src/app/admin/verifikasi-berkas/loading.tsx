export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="h-16 animate-pulse rounded-xl bg-line" />
      <div className="h-14 animate-pulse rounded-2xl bg-line" />
      <div className="grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)]">
        <div className="h-[620px] animate-pulse rounded-2xl bg-line" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[620px] animate-pulse rounded-2xl bg-line" />
          <div className="h-[620px] animate-pulse rounded-2xl bg-line" />
        </div>
      </div>
    </div>
  );
}
