import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/Table';

interface AddCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  newCounterName: string;
  setNewCounterName: (val: string) => void;
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
  newCounterName,
  setNewCounterName,
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
                    <label className="text-sm font-medium text-text-secondary">Counter Name</label>
                    <input 
                      type="text" required value={newCounterName} onChange={e => setNewCounterName(e.target.value)}
                      className="w-full bg-[#000000] border border-[#222222] rounded-xl h-11 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      placeholder="e.g. Counter 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary">Username</label>
                    <input 
                      type="text" required value={newUsername} onChange={e => setNewUsername(e.target.value)}
                      className="w-full bg-[#000000] border border-[#222222] rounded-xl h-11 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      placeholder="e.g. counter_user"
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
  onResolveReport
}: ReportGroupDetailsModalProps) {
  const [selectedUpiId, setSelectedUpiId] = useState('');

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
            className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-[#111111] border border-[#222222] shadow-[0_0_50px_rgba(139,92,246,0.15)] rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-300"
          >
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
                    {filteredReports.map((report: any, idx: number) => (
                      <TableRow key={report.id} className="hover:bg-[#222222]/20 border-b border-[#222222]/50 transition-colors animate-in slide-in-from-left duration-200">
                        <TableCell className="font-mono text-text-secondary text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-white font-semibold">{report.upi_id}</TableCell>
                        <TableCell className="font-mono text-purple-400 font-bold">
                          ₹{Number(report.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-text-secondary leading-relaxed max-w-[280px] truncate" title={report.details?.message}>
                          {report.details?.message || `Missing in Admin sheet.`}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onResolveReport(report.id)}
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 font-semibold rounded-lg text-xs h-8"
                          >
                            Resolve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#222222] bg-[#161616] flex justify-end">
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
