export function HomePageSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <section className="panel-dense min-h-[7.5rem] animate-pulse">
        <div className="h-4 w-32 rounded bg-panel2" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 w-20 rounded-lg bg-panel2" />
          ))}
        </div>
      </section>
      <div className="grid min-h-[17rem] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="panel min-h-[12rem] animate-pulse rounded-panel bg-panel2/40" />
        <div className="panel min-h-[17rem] animate-pulse rounded-panel bg-panel2/40" />
      </div>
      <section className="panel min-h-[12rem] animate-pulse rounded-panel bg-panel2/30" />
      <section className="panel min-h-[24rem] animate-pulse rounded-panel bg-panel2/20" />
    </div>
  );
}
