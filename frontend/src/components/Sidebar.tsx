import { NavLink } from "react-router-dom";
import markLogo from "../assets/accent1-transparent.png";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/algorithms", label: "Algorithms" },
  { to: "/training-models", label: "Training Models" },
  { to: "/algorithm-versions", label: "Algorithm Versions" },
  { to: "/results", label: "Results" },
  { to: "/upload-results", label: "Upload Results" },
  { to: "/admin", label: "Admin" },
];

function Sidebar() {
  return (
    <aside className="flex w-72 flex-col bg-[#09071b] text-slate-100 shadow-xl shadow-black/20">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 ring-1 ring-white/10">
            <img src={markLogo} alt="Robotic Fund mark" className="h-6 w-auto" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Robotic Fund</p>
            <h2 className="text-lg font-semibold text-white">Automation</h2>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-slate-800 text-white shadow-lg shadow-black/10"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-5 py-4 text-sm text-slate-400">
        <p className="mb-2 text-slate-300">Need help?</p>
        <p>Review the docs or reach out to your development team for the next iteration.</p>
      </div>
    </aside>
  );
}

export default Sidebar;
