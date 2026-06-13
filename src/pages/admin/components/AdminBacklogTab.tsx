import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Archive, RefreshCw, Trash2, Users, Loader2, Download, ChevronLeft } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/Table';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';

interface AdminBacklogTabProps {
  counterUploads: any[];
  adminUploads: any[];
  backlogStartDate: string;
  backlogEndDate: string;
  setBacklogStartDate: (date: string) => void;
  setBacklogEndDate: (date: string) => void;
  backlogLoading: boolean;
  backlogSubTab: 'counter' | 'admin';
  setBacklogSubTab: (tab: 'counter' | 'admin') => void;
  onWipeAdminBacklog: () => void;
  onWipeCounterBacklog: () => void;
  onDeleteBatch: (date: string, source: 'counter' | 'admin', counter_id: number | null, fileName?: string) => void;
  onDownloadBatch: (date: string, source: 'counter' | 'admin', counter_id: number | null, fileName?: string) => void;
  onDownloadFullBacklog: (source: 'counter' | 'admin') => void;
  onOpenBatchDetails: (batch: any) => void;
  onRefreshLogs: () => void;
}

export default function AdminBacklogTab({
  counterUploads,
  adminUploads,
  backlogStartDate,
  backlogEndDate,
  setBacklogStartDate,
  setBacklogEndDate,
  backlogLoading,
  backlogSubTab,
  setBacklogSubTab,
  onWipeAdminBacklog,
  onWipeCounterBacklog,
  onDeleteBatch,
  onDownloadBatch,
  onDownloadFullBacklog,
  onOpenBatchDetails,
  onRefreshLogs
}: AdminBacklogTabProps) {
  const backlogStartDateInputRef = useRef<HTMLInputElement>(null);
  const backlogEndDateInputRef = useRef<HTMLInputElement>(null);
  
  const [tempStartDate, setTempStartDate] = useState(backlogStartDate);
  const [tempEndDate, setTempEndDate] = useState(backlogEndDate);
  const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null);

  // Sync internal sub tab when switching
  useEffect(() => {
    setSelectedCounterId(null);
  }, [backlogSubTab]);

  useEffect(() => {
    setTempStartDate(backlogStartDate);
    setTempEndDate(backlogEndDate);
  }, [backlogStartDate, backlogEndDate]);

  const handleApplyDate = () => {
    setBacklogStartDate(tempStartDate);
    setBacklogEndDate(tempEndDate);
  };

  const handleClearDate = () => {
    setTempStartDate('');
    setTempEndDate('');
    setBacklogStartDate('');
    setBacklogEndDate('');
  };

  const isDateInRange = (dateStr: string) => {
    if (!backlogStartDate && !backlogEndDate) return true;
    const d = new Date(dateStr).getTime();
    const s = backlogStartDate ? new Date(backlogStartDate).getTime() : 0;
    const e = backlogEndDate ? new Date(backlogEndDate).getTime() : Infinity;
    return d >= s && d <= e;
  };

  // Filter helper applied inside the component to keep parent state simple
  const filteredCounterUploads = counterUploads
    .map(log => {
      const matchedUploads = log.uploads.filter((u: any) => isDateInRange(u.date));
      const totalCount = matchedUploads.reduce((acc: number, curr: any) => acc + curr.count, 0);
      return {
        ...log,
        uploads: matchedUploads,
        totalCount
      };
    })
    .filter(log => log.uploads.length > 0);

  const filteredAdminUploads = adminUploads.filter(log => isDateInRange(log.date));


  const cleanCounterName = (name: string) => {
    if (!name) return 'Unknown';
    return name;
  };


  return (
    <Card className="bg-[#111111] border-[#222222] animate-in fade-in slide-in-from-bottom-4 rounded-2xl shadow-xl overflow-hidden">
      {/* Subtab selection headers */}
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#222222] pb-6 gap-4">
        <div className="flex items-center gap-2">
          <Archive className="text-purple-400 w-6 h-6 animate-pulse" />
          <div>
            <CardTitle className="text-xl">Backlog History Reports</CardTitle>
            <p className="text-xs text-text-secondary mt-1">Audit, inspect, and wipe historic excel transaction batches.</p>
          </div>
        </div>
        
        {/* Controls area */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Pill Subtabs */}
          <div className="flex bg-[#000000] p-1 rounded-xl border border-[#222222]">
            <button 
              onClick={() => {
                setBacklogSubTab('counter');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                backlogSubTab === 'counter' ? 'bg-purple-600 text-white shadow-md' : 'text-text-secondary hover:text-white'
              }`}
            >
              According to Counters
            </button>
            <button 
              onClick={() => {
                setBacklogSubTab('admin');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                backlogSubTab === 'admin' ? 'bg-purple-600 text-white shadow-md' : 'text-text-secondary hover:text-white'
              }`}
            >
              According to Admin
            </button>
          </div>

          {/* Date Range Filter inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <div 
              onClick={() => {
                try { backlogStartDateInputRef.current?.showPicker(); } catch (e) { backlogStartDateInputRef.current?.focus(); }
              }}
              className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 cursor-pointer hover:border-purple-500/50 transition-colors"
            >
              <span className="text-xs text-text-secondary">From</span>
              <input 
                type="date" 
                ref={backlogStartDateInputRef}
                value={tempStartDate}
                onChange={e => setTempStartDate(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer" 
              />
            </div>
            <div 
              onClick={() => {
                try { backlogEndDateInputRef.current?.showPicker(); } catch (e) { backlogEndDateInputRef.current?.focus(); }
              }}
              className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 cursor-pointer hover:border-purple-500/50 transition-colors"
            >
              <span className="text-xs text-text-secondary">To</span>
              <input 
                type="date" 
                ref={backlogEndDateInputRef}
                value={tempEndDate}
                onChange={e => setTempEndDate(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer" 
              />
            </div>

            <Button
              onClick={handleApplyDate}
              disabled={!tempStartDate && !tempEndDate}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-[#222222] disabled:text-text-secondary text-white font-bold text-xs px-4 h-[34px] rounded-xl transition-all"
            >
              Apply
            </Button>

            {(backlogStartDate || backlogEndDate) && (
              <Button
                onClick={handleClearDate}
                variant="ghost"
                className="text-text-secondary hover:text-white font-bold text-xs px-3 h-[34px] rounded-xl"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Refresh logs button */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRefreshLogs} 
            className="w-9 h-9 p-0 rounded-xl bg-[#222222] border border-[#333333] hover:bg-[#333333]"
            title="Refresh Backlog Logs"
          >
            <RefreshCw className="w-4 h-4 text-purple-400" />
          </Button>

          {/* Wipe Database Backlog Button (Contextual) */}
          {backlogSubTab === 'counter' ? (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onDownloadFullBacklog('counter')} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all font-bold text-xs h-9 shadow-md"
                title="Download all Counter backlog history"
              >
                <Download className="w-4 h-4" />
                Download Counter Backlog
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onWipeCounterBacklog} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-400 hover:text-white transition-all font-bold text-xs h-9 shadow-md"
                title="Permanently wipe all Counter transaction database and reports backlog"
              >
                <Trash2 className="w-4 h-4" />
                Wipe Counter Backlog
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onDownloadFullBacklog('admin')} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all font-bold text-xs h-9 shadow-md"
                title="Download all Admin backlog history"
              >
                <Download className="w-4 h-4" />
                Download Admin Backlog
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onWipeAdminBacklog} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-400 hover:text-white transition-all font-bold text-xs h-9 shadow-md"
                title="Permanently wipe all Admin transaction database and reports backlog"
              >
                <Trash2 className="w-4 h-4" />
                Wipe Admin Backlog
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {backlogLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span>Retrieving backlog upload entries...</span>
          </div>
        ) : backlogSubTab === 'counter' ? (
          <div>
            {filteredCounterUploads.length === 0 ? (
              <div className="text-center py-16 text-text-secondary">
                No counter transaction uploads found matching active filters.
              </div>
            ) : (
              <div>
                {selectedCounterId ? (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="ghost" 
                        onClick={() => setSelectedCounterId(null)}
                        className="text-text-secondary hover:text-white px-3"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Counters
                      </Button>
                      <h3 className="text-xl font-bold text-white">
                        {filteredCounterUploads.find(l => l.counterId === selectedCounterId)?.counterName}
                      </h3>
                    </div>
                    
                    <div className="border border-[#222222] rounded-2xl overflow-hidden bg-[#0d0d0d] shadow-xl">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-[#222222] bg-[#161616]">
                            <TableHead>File</TableHead>
                            <TableHead>Upload Date</TableHead>
                            <TableHead className="text-center">Total Rows</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCounterUploads
                            .find(l => l.counterId === selectedCounterId)
                            ?.uploads.slice().reverse().map((upload: any, i: number) => (
                            <TableRow key={i} className="hover:bg-[#222222]/10 border-b border-[#222222]/50 transition-colors">
                              <TableCell className="font-bold text-white">Excel {i + 1}</TableCell>
                              <TableCell className="font-mono text-text-secondary">
                                {upload.date} {upload.fileName !== 'Unknown File' ? `(${upload.fileName})` : ''}
                              </TableCell>
                              <TableCell className="text-center font-mono text-purple-400 font-bold">
                                {upload.count} rows
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenBatchDetails({
                                    counter_id: selectedCounterId,
                                    counter_name: filteredCounterUploads.find(l => l.counterId === selectedCounterId)?.counterName,
                                    date: upload.date,
                                    source: 'counter'
                                  })}
                                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-4 font-bold rounded-xl text-xs h-8 transition-all"
                                >
                                  View Transactions
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCounterUploads.map((log) => {
                      return (
                        <motion.div
                          key={log.counterId}
                          onClick={() => setSelectedCounterId(log.counterId)}
                          className="group relative p-6 rounded-2xl border bg-gradient-to-br from-[#161616] to-[#0d0d0d] border-[#222222] transition-all duration-300 shadow-xl overflow-hidden flex flex-col justify-between cursor-pointer hover:border-purple-500/50"
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 transition-colors">
                              <Users className="w-5 h-5" />
                            </div>
                            <div className="flex-grow min-w-0">
                              <h4 className="text-sm font-bold text-white tracking-wide truncate" title={log.counterName}>
                                {cleanCounterName(log.counterName)}
                              </h4>
                              <p className="text-[11px] text-text-secondary mt-0.5 font-semibold">
                                {log.uploads.length} distinct upload dates
                              </p>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[#222222]/80 flex justify-between items-center text-xs mt-auto mb-4">
                            <span className="text-text-secondary">Total Transactions:</span>
                            <span className="font-mono text-purple-400 font-bold">{log.totalCount} rows</span>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownloadBatch('ALL', 'counter', log.counterId);
                              }}
                              className="flex-1 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl h-9 font-bold transition-all"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteBatch('ALL', 'counter', log.counterId);
                              }}
                              className="flex-1 bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white rounded-xl h-9 font-bold transition-all"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Admin Upload Date logs without delete action */
          <div className="border border-[#222222] rounded-2xl overflow-hidden bg-[#0d0d0d] shadow-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-[#222222] bg-[#161616]">
                  <TableHead>Admin Upload Name</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead className="text-center">Total Transaction Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdminUploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-text-secondary">
                      No admin transaction uploads found matching active filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdminUploads.map((log, idx) => (
                    <TableRow key={`${log.date}_${idx}`} className="hover:bg-[#222222]/10 border-b border-[#222222]/50 transition-colors">
                      <TableCell className="font-semibold text-white">
                        <span 
                          onClick={() => onOpenBatchDetails({
                            counter_id: null,
                            counter_name: 'Main Admin Sheet',
                            date: log.date,
                            source: 'admin'
                          })}
                          className="cursor-pointer underline text-purple-400 hover:text-purple-300 font-bold transition-colors"
                        >
                          Main Admin Sheet
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-text-secondary">{log.date}</TableCell>
                      <TableCell className="text-center font-mono text-purple-400 font-bold">{log.count} rows</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Completed
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenBatchDetails({
                              counter_id: null,
                              counter_name: 'Main Admin Sheet',
                              date: log.date,
                              source: 'admin'
                            })}
                            className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-4 font-bold rounded-xl text-xs h-8 transition-all"
                          >
                            View Transactions
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDownloadBatch(log.date, 'admin', null, log.fileName)}
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 font-bold rounded-xl h-8 transition-all"
                            title="Download Excel format"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteBatch(log.date, 'admin', null, log.fileName)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 font-bold rounded-xl h-8 transition-all"
                            title="Delete transactions for this day"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
