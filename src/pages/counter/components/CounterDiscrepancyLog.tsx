import { useState, useRef } from 'react';
import { AlertCircle, Loader2, CheckCircle2, Calendar, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface CounterDiscrepancyLogProps {
  reports: any[];
  reportsLoading: boolean;
}

export default function CounterDiscrepancyLog({
  reports,
  reportsLoading
}: CounterDiscrepancyLogProps) {
  const [tempFilterDate, setTempFilterDate] = useState('');
  const [appliedFilterDate, setAppliedFilterDate] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Apply filter locally
  const filteredReports = appliedFilterDate
    ? reports.filter(r => r.date === appliedFilterDate)
    : reports;

  const handleApply = () => {
    setAppliedFilterDate(tempFilterDate);
  };

  const handleClear = () => {
    setTempFilterDate('');
    setAppliedFilterDate('');
  };

  return (
    <Card className="bg-[#111111] border-[#222222] rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden">
      <CardHeader className="border-b border-[#222222] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#151515]">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-purple-400" />
          <CardTitle className="text-lg font-bold text-white">
            Discrepancy Log
          </CardTitle>
          {filteredReports.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-400 border border-red-500/20">
              {filteredReports.length} Alerts
            </span>
          )}
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div 
            onClick={() => {
              try {
                dateInputRef.current?.showPicker();
              } catch (e) {
                dateInputRef.current?.focus();
              }
            }}
            className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 cursor-pointer hover:border-purple-500/50 transition-colors w-full sm:w-auto"
          >
            <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <input 
              type="date" 
              ref={dateInputRef}
              value={tempFilterDate}
              onChange={e => setTempFilterDate(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full" 
            />
            {tempFilterDate && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }} 
                className="text-text-secondary hover:text-white ml-1 font-bold"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <Button
            onClick={handleApply}
            disabled={!tempFilterDate}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-[#222222] disabled:text-text-secondary text-white font-bold text-xs px-4 h-[34px] rounded-xl transition-all"
          >
            Apply
          </Button>

          {appliedFilterDate && (
            <Button
              onClick={handleClear}
              variant="ghost"
              className="text-text-secondary hover:text-white font-bold text-xs px-3 h-[34px] rounded-xl"
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 flex flex-col justify-start overflow-hidden">
        {reportsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3 w-full">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="text-xs">Reconciling records...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8 w-full">
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 animate-pulse">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="font-bold text-white text-base">Perfect Reconciliation</h4>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[320px]">
              All transactions uploaded by your counter are fully balanced against server records. No discrepancies detected.
            </p>
            <div className="w-full max-w-xs border-t border-[#222222]/50 pt-4 mt-2 text-left mx-auto">
              <span className="text-[10px] text-text-secondary uppercase tracking-widest block mb-2 text-center">Reconciliation Status</span>
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>Admin Excel Checked</span>
                <span className="text-emerald-400 text-right">Verified</span>
              </div>
            </div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 w-full">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-sm">No Discrepancies on This Date</h4>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[300px] mt-1">
              No mismatch entries found for <span className="text-purple-400 font-mono">{appliedFilterDate}</span>. Discrepancies are active on other dates.
            </p>
            <Button onClick={handleClear} variant="ghost" className="text-purple-400 hover:text-purple-300 font-bold text-xs mt-4">
              Show All Dates
            </Button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
              The following discrepancies have been generated by the administrator. Please audit your entries:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/30 scrollbar-track-transparent">
              {filteredReports.map((report) => (
                <div 
                  key={report.id}
                  className="p-4 bg-[#0d0d0d] border border-[#222222] rounded-xl space-y-2.5 transition-all hover:border-purple-500/20"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded">
                      {report.date}
                    </span>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      report.type === 'missing_in_admin'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : report.type === 'mismatched_amount'
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    }`}>
                      {report.type === 'missing_in_admin' ? 'Missing UTR' : report.type === 'mismatched_amount' ? 'Amount Error' : 'Duplicate'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[11px] font-semibold text-text-secondary">
                      Ref / Cheque: <span className="text-white font-mono">{report.upi_id}</span>
                    </span>
                    <span className="block text-[11px] font-semibold text-text-secondary">
                      Amount: <span className="text-purple-400 font-bold">₹{Number(report.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </span>
                    {report.details?.admin_remark && (
                      <span className="block text-[11px] font-semibold text-text-secondary pt-1">
                        Admin Remark: <span className="text-emerald-400 font-bold">{report.details.admin_remark}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed pt-1.5 border-t border-[#222222]/50 italic">
                    {report.details?.message || 'Check amount and transaction reference matches.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
