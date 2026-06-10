import markLogo from "../assets/accent1-transparent.svg";

function Topbar() {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-800 bg-[#11082a]/95 px-6 py-6 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <img src={markLogo} alt="Robotic Fund mark" className="h-24 w-auto" />
        <div className="space-y-1 text-left">
          <div className="text-3xl font-semibold uppercase tracking-[0.3em] text-pink-400">Robotic Fund</div>
          <p className="text-sm text-slate-300">Trade engine dashboard</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-900/80 px-4 py-2 text-sm text-slate-300 shadow-sm shadow-black/20">
          <img src={markLogo} alt="Robotic Fund mark" className="h-8 w-auto" />
          <span className="font-medium text-slate-100">trade-engine</span>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
