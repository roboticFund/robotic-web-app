import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

export default Layout;
