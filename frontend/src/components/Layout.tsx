import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 opacity-80" />
        <div className="relative flex min-h-screen">
          <Sidebar />
          <div className="flex-1">
            <Topbar />
            <main className="px-6 pb-10 pt-6">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Layout;
