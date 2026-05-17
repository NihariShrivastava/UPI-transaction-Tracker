import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, Users, AlertTriangle, Archive } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';

interface AdminHeaderProps {
  countersCount: number;
  totalDiscrepancies: number;
  totalExcelEntries: number;
}

export default function AdminHeader({
  countersCount,
  totalDiscrepancies,
  totalExcelEntries
}: AdminHeaderProps) {
  return (
    <div className="space-y-6">
      {/* Elegant Welcome Banner Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-r from-[#111111] to-[#222222]/30 border-[#222222] overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-32 h-32 text-purple-500" />
          </div>
          <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Database Live & Active
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Welcome back, <span className="text-purple-400">Admin</span>
              </h1>
              <p className="max-w-2xl text-base text-text-secondary">
                Monitor counter activities, compare system excels with admin transactions, and reconcile UPI discrepancies.
              </p>
            </div>
            <div className="flex gap-4 shrink-0">
              <div className="bg-[#09090b]/80 border border-[#222222] px-5 py-4 rounded-2xl text-center">
                <span className="block text-2xl font-bold text-white">{countersCount}</span>
                <span className="text-xs text-text-secondary">Counters</span>
              </div>
              <div className="bg-[#09090b]/80 border border-[#222222] px-5 py-4 rounded-2xl text-center">
                <span className="block text-2xl font-bold text-purple-400">Live</span>
                <span className="text-xs text-text-secondary">System Mode</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stat Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/20 transition-all p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Total Active Accounts</span>
              <h3 className="text-3xl font-bold text-white mt-1">{countersCount}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>
        <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/20 transition-all p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Total Discrepancies</span>
              <h3 className={`text-3xl font-bold mt-1 transition-all ${
                totalDiscrepancies > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {totalDiscrepancies}
              </h3>
            </div>
            <div className={`p-3 rounded-xl transition-all ${
              totalDiscrepancies > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </Card>
        <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/20 transition-all p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Total Excel Entries Count</span>
              <h3 className="text-3xl font-bold text-purple-400 mt-1 font-mono">{totalExcelEntries.toLocaleString('en-IN')}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <Archive className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
