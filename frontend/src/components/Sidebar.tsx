import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/algorithms", label: "Algorithms" },
  { to: "/training-models", label: "Training Models" },
  { to: "/upload-results", label: "Upload Results" },
];

function Sidebar() {
  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-50 p-6">
      <div className="mb-10">
        <span className="text-lg font-semibold text-slate-900">Robotic Web App</span>
      </div>
      <nav className="space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-xl px-4 py-3 text-sm font-medium ${
                isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
