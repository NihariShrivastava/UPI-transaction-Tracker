import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Search, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/Table';

interface AddCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  newUsername: string;
  setNewUsername: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

interface ReportGroupDetailsModalProps {
  group: any;
  onClose: () => void;
  reportsFilterDate: string;
  onResolveReport: (id: number) => void;
  onEditReport: (id: number, newUpiId: string, newAmount: number) => Promise<void>;
  onMatchReport?: (id: number) => Promise<boolean>;
  onMatchAllReports?: () => Promise<{ allMatched: boolean, remainingCount: number }>;
}

interface BatchDetailsModalProps {
  batch: any;
  onClose: () => void;
  batchDetailsLoading: boolean;
  batchDetailsData: any[];
  batchDetailsSearch: string;
  setBatchDetailsSearch: (val: string) => void;
}

export function AddCounterModal({
  isOpen,
  onClose,
  newUsername,
  setNewUsername,
  newPassword,
  setNewPassword,
  onSubmit
}: AddCounterModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md"
          >
            <Card className="bg-[#111111] border-[#222222] shadow-[0_0_50px_rgba(139,92,246,0.15)] rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[#222222]">
                <CardTitle className="text-xl text-purple-400 font-bold">Add New Counter</CardTitle>
                <button onClick={onClose} className="text-text-secondary hover:text-white p-1 rounded-lg hover:bg-[#222222] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary">Username / Counter Name</label>
                    <input 
                      type="text" required value={newUsername} onChange={e => setNewUsername(e.target.value)}
                      className="w-full bg-[#000000] border border-[#222222] rounded-xl h-11 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      placeholder="e.g. Counter_Sales"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary">Password</label>
                    <input 
                      type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-[#000000] border border-[#222222] rounded-xl h-11 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      placeholder="Enter password"
                    />
                  </div>
                  <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
                    <Button type="submit" variant="primary" className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)]">Create Counter</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ReportGroupDetailsModal({
  group,
  onClose,
  reportsFilterDate,
  onResolveReport,
  onEditReport,
  onMatchReport,
  onMatchAllReports
}: ReportGroupDetailsModalProps) {
  const [selectedUpiId, setSelectedUpiId] = useState('');
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [editUpiId, setEditUpiId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMatching, setIsMatching] = useState<{ [key: number]: boolean }>({});
  const [isMatchingAll, setIsMatchingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uniqueUpiIds = group && group.counterName
    ? [group.counterName]
    : [];

  const filteredReports = group && selectedUpiId && selectedUpiId !== group.counterName
    ? group.reports.filter((r: any) => r.upi_id === selectedUpiId)
    : group ? group.reports : [];

  const totalAmount = filteredReports.reduce((acc: number, r: any) => acc + Number(r.amount), 0);

  return (
    <AnimatePresence>
      {group && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-[#111111] border border-[#222222] shadow-[0_0_50px_rgba(139,92,246,0.15)] rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-300"
          >
            {/* Error Popup */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.2)] backdrop-blur-md max-w-sm w-full"
                >
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-semibold">{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="ml-auto hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#222222] bg-[#161616]">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  Counter Discrepancy Audit
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Counter: <span className="text-purple-400 font-bold">{group.counterName}</span> | Date: <span className="text-purple-400 font-bold">{reportsFilterDate || 'All Dates'}</span>
                </p>
              </div>
              <button 
                onClick={onClose} 
                className="text-text-secondary hover:text-white p-2 rounded-xl hover:bg-[#222222] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Bar & Filter */}
            <div className="px-6 py-4 bg-[#111111] border-b border-[#222222]/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap gap-6 text-xs text-text-secondary">
                <div>
                  Total Discrepancies: <span className="text-white font-bold">{filteredReports.length} of {group.reports.length} items</span>
                </div>
                <div>
                  Mismatched Value Sum: <span className="text-purple-400 font-bold">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* ID selector dropdown */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-text-secondary whitespace-nowrap font-medium">Filter by PhonePe / UPI ID:</span>
                <select
                  value={selectedUpiId}
                  onChange={e => setSelectedUpiId(e.target.value)}
                  className="w-full md:w-[220px] bg-[#000000] border border-[#222222] hover:border-purple-500/50 focus:border-purple-500 rounded-xl h-9 px-3 text-xs text-white focus:outline-none transition-all cursor-pointer"
                >
                  <option value="">All UPI IDs / PhonePe IDs</option>
                  {uniqueUpiIds.map((id: any) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
                {selectedUpiId && (
                  <button
                    onClick={() => setSelectedUpiId('')}
                    className="text-text-secondary hover:text-white p-1"
                    title="Clear ID filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-grow overflow-auto p-6 min-h-[250px]">
              <div className="border border-[#222222] rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-[#222222] bg-[#161616]">
                      <TableHead className="w-[80px]">#</TableHead>
                      <TableHead>Cheque Number / UTR</TableHead>
                      <TableHead>Mismatched Amount</TableHead>
                      <TableHead>Discrepancy Details</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...filteredReports]
                      .sort((a, b) => {
                        const aEdited = a.details?.is_edited === true;
                        const bEdited = b.details?.is_edited === true;
                        if (aEdited && !bEdited) return -1;
                        if (!aEdited && bEdited) return 1;
                        return 0;
                      })
                      .map((report: any, idx: number) => {
                      const isEditing = editingReportId === report.id;
                      const isEditedAndFailed = report.details?.is_edited === true && report.details?.is_failed_match === true;
                      return (
                        <TableRow key={report.id} className={`border-b border-[#222222]/50 transition-colors animate-in slide-in-from-left duration-200 ${isEditedAndFailed ? 'bg-purple-900/30 hover:bg-purple-900/40' : 'hover:bg-[#222222]/20'}`}>
                          <TableCell className="font-mono text-text-secondary text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-white font-semibold">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUpiId}
                                onChange={e => setEditUpiId(e.target.value)}
                                className="w-full bg-[#000000] border border-purple-500/50 rounded-xl h-9 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                              />
                            ) : (
                              report.upi_id
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-purple-400 font-bold">
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400 text-xs">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editAmount}
                                  onChange={e => setEditAmount(e.target.value)}
                                  className="w-[120px] bg-[#000000] border border-purple-500/50 rounded-xl h-9 pl-6 pr-3 text-xs text-purple-400 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                />
                              </div>
                            ) : (
                              `₹${Number(report.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-purple-400 font-medium leading-relaxed max-w-[280px]">
                            <div className="flex flex-col gap-1.5 items-start w-full">
                              <span className="truncate w-full block" title={report.details?.message}>
                                {report.details?.message || `Missing in Admin sheet.`}
                              </span>
                              {report.type === 'duplicate_upi' && report.details?.count && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold text-[10px] tracking-wider uppercase shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                                  {report.details.count} Duplicates Found
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="primary" 
                                  size="sm" 
                                  disabled={isSaving}
                                  onClick={async () => {
                                    if (!editUpiId.trim() || !editAmount.trim()) {
                                      alert("Cheque/UTR and Amount cannot be empty.");
                                      return;
                                    }
                                    setIsSaving(true);
                                    try {
                                      await onEditReport(report.id, editUpiId, Number(editAmount));
                                      setEditingReportId(null);
                                    } catch (e) {
                                      console.error(e);
                                    } finally {
                                      setIsSaving(false);
                                    }
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs h-8 px-4"
                                >
                                  {isSaving ? "Saving..." : "Save"}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  disabled={isSaving}
                                  onClick={() => setEditingReportId(null)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-semibold rounded-lg text-xs h-8 px-3"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    setEditingReportId(report.id);
                                    setEditUpiId(report.upi_id);
                                    setEditAmount(String(report.amount));
                                  }}
                                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-3 font-semibold rounded-lg text-xs h-8"
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  disabled={isMatching[report.id]}
                                  onClick={async () => {
                                    if (onMatchReport) {
                                      setIsMatching(prev => ({ ...prev, [report.id]: true }));
                                      const isMatched = await onMatchReport(report.id);
                                      setIsMatching(prev => ({ ...prev, [report.id]: false }));
                                      if (!isMatched) {
                                        setErrorMessage("This entry did not match any uploaded Admin Excel records.");
                                        setTimeout(() => setErrorMessage(null), 5000);
                                      }
                                    } else {
                                      onResolveReport(report.id);
                                    }
                                  }}
                                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 font-semibold rounded-lg text-xs h-8"
                                >
                                  {isMatching[report.id] ? "Matching..." : "Match"}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#222222] bg-[#161616] flex justify-end gap-3">
              {onMatchAllReports && (
                <Button 
                  onClick={async () => {
                    setIsMatchingAll(true);
                    const result = await onMatchAllReports();
                    setIsMatchingAll(false);
                    if (!result.allMatched) {
                      setErrorMessage(`${result.remainingCount} entries did not match any Admin Excel records.`);
                      setTimeout(() => setErrorMessage(null), 5000);
                    }
                  }} 
                  disabled={isMatchingAll || filteredReports.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg font-semibold h-10 px-6"
                >
                  {isMatchingAll ? "Matching..." : "Match All Entry"}
                </Button>
              )}
              <Button 
                onClick={onClose} 
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg font-semibold h-10 px-6"
              >
                Close Audit
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function BatchDetailsModal({
  batch,
  onClose,
  batchDetailsLoading,
  batchDetailsData,
  batchDetailsSearch,
  setBatchDetailsSearch
}: BatchDetailsModalProps) {
  return (
    <AnimatePresence>
      {batch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-[#111111] border border-[#222222] shadow-[0_0_50px_rgba(139,92,246,0.15)] rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#222222] bg-[#161616]">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  Excel Batch Details
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Batch: <span className="text-purple-400 font-bold">{batch.counter_name}</span> | Date: <span className="text-purple-400 font-bold">{batch.date}</span>
                </p>
              </div>
              <button 
                onClick={onClose} 
                className="text-text-secondary hover:text-white p-2 rounded-xl hover:bg-[#222222] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controls (Search) */}
            <div className="p-4 border-b border-[#222222] bg-[#111111] flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-4 py-2 w-full max-w-sm">
                <Search className="w-4 h-4 text-purple-400 shrink-0" />
                <input 
                  type="text" 
                  value={batchDetailsSearch}
                  onChange={e => setBatchDetailsSearch(e.target.value)}
                  placeholder="Search by Cheque / UTR..."
                  className="bg-transparent text-sm text-white focus:outline-none w-full"
                />
                {batchDetailsSearch && (
                  <button onClick={() => setBatchDetailsSearch('')} className="text-text-secondary hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs text-text-secondary font-medium">
                Showing {
                  batchDetailsData.filter(t => 
                    String(t.upi_id).toLowerCase().includes(batchDetailsSearch.toLowerCase())
                  ).length
                } of {batchDetailsData.length} records
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-grow overflow-auto p-6 min-h-[250px]">
              {batchDetailsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <span>Loading batch rows from database...</span>
                </div>
              ) : batchDetailsData.length === 0 ? (
                <div className="text-center py-20 text-text-secondary">
                  No transactions found in this upload batch.
                </div>
              ) : (
                <div className="border border-[#222222] rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-[#222222] bg-[#161616]">
                        <TableHead className="w-[100px]">#</TableHead>
                        <TableHead>Cheque Number / UTR</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Receipt / Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchDetailsData
                        .filter(t => 
                          String(t.upi_id).toLowerCase().includes(batchDetailsSearch.toLowerCase())
                        )
                        .map((t, idx) => (
                          <TableRow key={t.id} className="hover:bg-[#222222]/20 border-b border-[#222222]/50 transition-colors">
                            <TableCell className="font-mono text-text-secondary text-xs">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-white font-semibold">{t.upi_id}</TableCell>
                            <TableCell className="font-mono text-text-secondary">{t.date}</TableCell>
                            <TableCell className="text-right font-mono text-purple-400 font-bold">
                              ₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#222222] bg-[#161616] flex justify-end">
              <Button 
                onClick={onClose} 
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg font-semibold h-10 px-6"
              >
                Close Batch
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface DuplicateDetailsModalProps {
  report: any;
  onClose: () => void;
}

export function DuplicateDetailsModal({ report, onClose }: DuplicateDetailsModalProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!report) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, upi_id, amount, date, source, counter_id, users(counter_name)')
          .eq('date', report.date)
          .eq('upi_id', report.upi_id)
          .order('source', { ascending: false });
        
        if (!error && data) {
          setTransactions(data);
        }
      } catch (err) {
        console.error("Failed to fetch duplicate transactions", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
  }, [report]);

  if (!report) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-gradient-to-br from-[#161616] to-[#0d0d0d] border border-[#222222] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-6 border-b border-[#222222]/50 bg-black/40">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Duplicate Entries Found
              </h2>
              <p className="text-sm text-text-secondary mt-1 font-mono">
                UTR / Cheque No: <span className="text-purple-400 font-bold">{report.upi_id}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-text-secondary hover:text-white hover:bg-[#222222] rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-20 text-text-secondary font-mono">
                No duplicate transactions found in the database.
              </div>
            ) : (
              <div className="rounded-xl border border-[#222222]/50 overflow-hidden bg-black/20">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-[#222222]/50">
                      <TableHead>Source</TableHead>
                      <TableHead>Counter Name</TableHead>
                      <TableHead className="text-right">Amount (₹)</TableHead>
                      <TableHead className="text-right">Transaction Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-b border-[#222222]/50 hover:bg-[#222222]/30 transition-colors">
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            tx.source === 'admin' 
                              ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400'
                              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          }`}>
                            {tx.source}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-white text-sm font-semibold">
                          {tx.source === 'admin' ? 'Admin Sheet' : tx.users?.counter_name || `Counter ${tx.counter_id}`}
                        </TableCell>
                        <TableCell className="text-right font-mono text-purple-400 font-bold">
                          ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-text-secondary text-sm">
                          {tx.date ? new Date(tx.date).toLocaleDateString('en-GB') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-[#222222]/50 bg-black/40 flex justify-end">
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="bg-[#222222] hover:bg-[#333333] text-white rounded-xl shadow-lg font-semibold h-10 px-6"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
