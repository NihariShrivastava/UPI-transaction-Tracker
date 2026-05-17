import { ArrowRightLeft, IndianRupee } from 'lucide-react';

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-800 shadow-[0_0_15px_rgba(168,85,247,0.5)]">
        <IndianRupee className="w-5 h-5 text-white absolute" />
        <ArrowRightLeft className="w-8 h-8 text-white/30 absolute rotate-45" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight leading-tight">
          UPI Tracker
        </span>
        <span className="text-[0.65rem] font-medium text-purple-400 tracking-widest uppercase">
          Transaction Portal
        </span>
      </div>
    </div>
  );
}
