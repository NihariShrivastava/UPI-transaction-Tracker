import Logo from '../../../components/ui/Logo';

interface CounterHeaderProps {
  username: string;
  onLogout: () => void;
}

export default function CounterHeader({ username, onLogout }: CounterHeaderProps) {
  return (
    <header className="border-b border-[#222222] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-text-secondary">Counter Portal</span>
            <span className="text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              {username}
            </span>
          </div>
          <button 
            onClick={onLogout}
            className="text-xs font-semibold text-text-secondary hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-[#222222]"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
