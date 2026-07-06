import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';

export function AppShell() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-base leading-relaxed text-foreground">
      <TopNav />
      <main className="mobile-main-pad mx-auto max-w-[1280px] px-4 pt-6 md:px-6 md:pb-10">
        <Outlet />
        <Footer />
      </main>
      <BottomNav />
    </div>
  );
}
