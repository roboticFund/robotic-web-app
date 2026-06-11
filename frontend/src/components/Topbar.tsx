import markLogo from "../assets/accent1-transparent.svg";

function Topbar() {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-800 bg-[#11082a]/95 px-5 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <img src={markLogo} alt="Robotic Fund mark" className="h-12 w-auto" />
        <div className="text-left">
          <div className="text-xl font-semibold uppercase tracking-[0.24em] text-pink-400">Robotic Fund</div>
          <p className="text-xs text-slate-300">Trade engine dashboard</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 shadow-sm shadow-black/20">
          <img src={markLogo} alt="Robotic Fund mark" className="h-6 w-auto" />
          <span className="font-medium text-slate-100">trade-engine</span>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
