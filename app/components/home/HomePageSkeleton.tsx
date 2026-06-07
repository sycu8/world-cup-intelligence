export function HomePageSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <section className="panel-elevated min-h-[10rem] animate-pulse rounded-panel bg-panel2/30" />
      <section className="panel min-h-[24rem] animate-pulse rounded-panel bg-panel2/20" />
      <div className="grid min-h-[17rem] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-4">
          <div className="panel min-h-[12rem] animate-pulse rounded-panel bg-panel2/40" />
          <div className="panel min-h-[10rem] flex-1 animate-pulse rounded-panel bg-panel2/35" />
        </div>
        <div className="panel min-h-[17rem] animate-pulse rounded-panel bg-panel2/40" />
      </div>
      <section className="panel min-h-[12rem] animate-pulse rounded-panel bg-panel2/30" />
    </div>
  );
}
