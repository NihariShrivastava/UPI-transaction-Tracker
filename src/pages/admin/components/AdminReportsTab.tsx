import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, AlertTriangle, Calendar, X, Users } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/Table';

interface AdminReportsTabProps {
  reportsData: any[];
  reportsLoading: boolean;
  reportsFilterDate: string;
  setReportsFilterDate: (date: string) => void;
  currentSlide: number;
  slides: string[];
  nextSlide: () => void;
  prevSlide: () => void;
  onOpenGroupDetails: (group: any) => void;
  groupedReportsByCounter: any[];
  onEditReport?: (id: number, newUpiId: string, newAmount: number) => Promise<void>;
  onMatchReport?: (id: number) => Promise<boolean>;
  overviewData?: any[];
  overviewLoading?: boolean;
  onOpenDuplicateDetails?: (report: any) => void;
}

export default function AdminReportsTab({
  reportsData,
  reportsLoading,
  reportsFilterDate,
  setReportsFilterDate,
  currentSlide,
  slides,
  nextSlide,
  prevSlide,
  onOpenGroupDetails,
  groupedReportsByCounter,
  onEditReport,
  onMatchReport,
  overviewData,
  overviewLoading,
  onOpenDuplicateDetails
}: AdminReportsTabProps) {
  const reportsDateInputRef = useRef<HTMLInputElement>(null);
  const [tempFilterDate, setTempFilterDate] = useState(reportsFilterDate);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [editUpiId, setEditUpiId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMatching, setIsMatching] = useState<{ [key: number]: boolean }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setTempFilterDate(reportsFilterDate);
  }, [reportsFilterDate]);

  const handleApplyDate = () => {
    setReportsFilterDate(tempFilterDate);
  };

  const handleClearDate = () => {
    setTempFilterDate('');
    setReportsFilterDate('');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Slider Navigation Header */}
      <div className="bg-[#111111] border-y border-[#222222] flex items-center justify-between p-4 rounded-2xl shadow-lg">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={prevSlide} 
          className="w-10 h-10 p-0 rounded-xl bg-[#222222] border-[#333333] hover:bg-[#333333]"
        >
          <ChevronLeft className="w-5 h-5 text-purple-400" />
        </Button>
        
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-extrabold text-white tracking-widest uppercase mb-2">
            {slides[currentSlide]}
          </h2>
          <div className="flex gap-1.5">
            {slides.map((_, index) => (
              <div 
                key={index} 
                className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === index ? 'w-6 bg-purple-500' : 'w-1.5 bg-[#333333]'}`}
              />
            ))}
          </div>
        </div>

        <Button 
          variant="secondary" 
          size="sm" 
          onClick={nextSlide} 
          className="w-10 h-10 p-0 rounded-xl bg-[#222222] border-[#333333] hover:bg-[#333333]"
        >
          <ChevronRight className="w-5 h-5 text-purple-400" />
        </Button>
      </div>

      {/* Slide Content with Date Filter & Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 shadow-2xl relative overflow-hidden min-h-[400px]">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="text-sm text-text-secondary flex items-center">
            <AlertTriangle className={`w-4 h-4 mr-2 ${
              currentSlide === 0 ? 'text-red-400' : currentSlide === 1 ? 'text-yellow-400' : 'text-orange-400'
            }`} />
            Viewing verified live discrepancy reports.
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <div 
              onClick={() => {
                try {
                  reportsDateInputRef.current?.showPicker();
                } catch (e) {
                  reportsDateInputRef.current?.focus();
                }
              }}
              className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 cursor-pointer hover:border-purple-500/50 transition-colors w-full sm:w-auto"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <input 
                type="date" 
                ref={reportsDateInputRef}
                value={tempFilterDate}
                onChange={e => setTempFilterDate(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full" 
              />
              {tempFilterDate && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearDate();
                  }} 
                  className="text-text-secondary hover:text-white ml-1 font-bold"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <Button
              onClick={handleApplyDate}
              disabled={!tempFilterDate}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-[#222222] disabled:text-text-secondary text-white font-bold text-xs px-4 h-[34px] rounded-xl transition-all"
            >
              Apply
            </Button>

            {reportsFilterDate && (
              <Button
                onClick={handleClearDate}
                variant="ghost"
                className="text-text-secondary hover:text-white font-bold text-xs px-3 h-[34px] rounded-xl"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Error Popup */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center justify-between bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl shadow-lg"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {reportsLoading && currentSlide !== 3 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading live reports from Supabase...</span>
          </div>
        ) : currentSlide !== 3 && reportsData.length === 0 ? (
          <div className="text-center py-16 text-emerald-400 font-semibold bg-emerald-500/5 rounded-2xl border border-emerald-500/10 shadow-lg">
            {reportsFilterDate 
              ? "Perfect match! No discrepancies found on this date."
              : "Awesome! No live discrepancy reports found in the database."}
          </div>
        ) : (
          <div>
            {(currentSlide === 1 || currentSlide === 2) && (
              <div className="mb-6 p-4 bg-[#151515] border border-[#222222] rounded-2xl flex items-center justify-between shadow-md animate-in fade-in duration-300">
                <span className="text-xs text-text-secondary font-medium">
                  Total Discrepancies Count:
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                  currentSlide === 1 
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                }`}>
                  {reportsData.length} {currentSlide === 1 ? 'Cards Mismatched' : 'Duplicate Entries'}
                </span>
              </div>
            )}
            {currentSlide === 0 ? (
              /* Slide 0: Missing in Admin (Grouped by Counter Cards) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                {groupedReportsByCounter.map((group, idx) => (
                  <motion.div
                    key={`${group.counterId || 'unknown'}_${idx}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    onClick={() => onOpenGroupDetails(group)}
                    className="group relative bg-gradient-to-br from-[#161616] to-[#0d0d0d] border border-[#222222] hover:border-purple-500/40 p-6 rounded-2xl transition-all duration-300 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center justify-center p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                          <Users className="w-5 h-5" />
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          Unmatched
                        </span>
                      </div>

                      <h4 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                        {group.counterName}
                      </h4>
                      <p className="text-xs text-text-secondary mt-1">
                        Discrepancy: <span className="text-white font-bold">{group.reports.length} items</span> completely missing in Admin spreadsheet.
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                      <span className="text-sm font-mono text-purple-400 font-bold">
                        ₹{group.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-purple-400 group-hover:underline font-bold transition-all flex items-center gap-1">
                        Inspect details <span>→</span>
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : currentSlide === 3 ? (
              /* Slide 3: Overview */
              <div className="bg-[#151515] border border-[#222222] rounded-2xl p-6">
                {overviewLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : overviewData?.length === 0 ? (
                  <div className="text-center py-10 text-text-secondary">No overview data available.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-[#222222]">
                        <TableHead>Counter Name</TableHead>
                        <TableHead className="text-right">Total Uploaded</TableHead>
                        <TableHead className="text-right">Discrepancies</TableHead>
                        <TableHead className="text-right">Matched Cases</TableHead>
                        <TableHead className="text-right">Match Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overviewData?.map(stat => (
                        <TableRow key={stat.counterId} className="border-b border-[#222222]/50 hover:bg-[#222222]/20">
                          <TableCell className="font-bold text-white">{stat.counterName}</TableCell>
                          <TableCell className="text-right text-text-secondary font-mono">{stat.uploaded}</TableCell>
                          <TableCell className="text-right text-orange-400 font-mono font-semibold">{stat.discrepancies}</TableCell>
                          <TableCell className="text-right text-emerald-400 font-mono font-semibold">{stat.matched}</TableCell>
                          <TableCell className="text-right text-purple-400 font-mono font-semibold">
                            {stat.uploaded > 0 ? ((stat.matched / stat.uploaded) * 100).toFixed(1) + '%' : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              /* Slide 1 & Slide 2: Render premium individual cards */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                {[...reportsData]
                  .sort((a, b) => {
                    const aEdited = a.details?.is_edited === true;
                    const bEdited = b.details?.is_edited === true;
                    if (aEdited && !bEdited) return -1;
                    if (!aEdited && bEdited) return 1;
                    return 0;
                  })
                  .map((report) => {
                  const isEditing = editingReportId === report.id;
                  const isEditedAndFailed = report.details?.is_edited === true && report.details?.is_failed_match === true;
                  return (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={!isEditing ? { y: -4 } : {}}
                    onClick={() => {
                      if (!isEditing && report.type === 'duplicate_upi' && onOpenDuplicateDetails) {
                        onOpenDuplicateDetails(report);
                      }
                    }}
                    className={`group relative border ${
                      isEditedAndFailed 
                        ? 'bg-purple-900/30 border-purple-500/50 hover:bg-purple-900/40' 
                        : 'bg-gradient-to-br from-[#161616] to-[#0d0d0d] border-[#222222] hover:border-purple-500/30'
                    } p-6 rounded-2xl transition-all duration-300 shadow-xl overflow-hidden flex flex-col justify-between ${
                      !isEditing && report.type === 'duplicate_upi' ? 'cursor-pointer' : ''
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-mono text-text-secondary truncate max-w-[150px]">
                          Ref: {report.upi_id}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          report.type === 'missing_in_counter' 
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        }`}>
                          {report.type === 'missing_in_counter' ? 'Missing Counter' : 'Duplicate'}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-3 mt-2 relative z-10">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-1 block">Cheque Number / UTR</label>
                            <input
                              type="text"
                              value={editUpiId}
                              onChange={e => setEditUpiId(e.target.value)}
                              className="w-full bg-[#000000] border border-purple-500/50 rounded-xl h-9 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-1 block">Amount (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              className="w-full bg-[#000000] border border-purple-500/50 rounded-xl h-9 px-3 text-xs text-purple-400 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-sm font-bold text-white font-mono truncate" title={report.upi_id}>
                            {report.upi_id}
                          </h4>
                          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                            {report.details?.message || (
                              report.type === 'missing_in_counter'
                                ? 'Available in Admin Excel sheet but missing from all Counter sheets.'
                                : 'Multiple transaction instances found on this date.'
                            )}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#222222]/80 flex items-center justify-between relative z-10">
                      <span className="text-sm font-mono text-purple-400 font-bold">
                        {!isEditing && `₹${Number(report.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </span>
                      
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            disabled={isSaving}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingReportId(null);
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-semibold rounded-lg text-[10px] h-7 px-3"
                          >
                            Cancel
                          </Button>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            disabled={isSaving}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!editUpiId.trim() || !editAmount.trim()) {
                                setErrorMessage("Cheque/UTR and Amount cannot be empty.");
                                return;
                              }
                              setIsSaving(true);
                              try {
                                if (onEditReport) {
                                  await onEditReport(report.id, editUpiId, Number(editAmount));
                                }
                                setEditingReportId(null);
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setIsSaving(false);
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[10px] h-7 px-3"
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {onEditReport && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingReportId(report.id);
                                setEditUpiId(report.upi_id);
                                setEditAmount(String(report.amount));
                              }}
                              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-2 font-semibold rounded-lg text-[10px] h-7"
                            >
                              Edit
                            </Button>
                          )}
                          {onMatchReport && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isMatching[report.id]}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setIsMatching(prev => ({ ...prev, [report.id]: true }));
                                const isMatched = await onMatchReport(report.id);
                                setIsMatching(prev => ({ ...prev, [report.id]: false }));
                                if (!isMatched) {
                                  setErrorMessage("This entry did not match any uploaded Admin Excel records.");
                                  setTimeout(() => setErrorMessage(null), 5000);
                                }
                              }}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2 font-semibold rounded-lg text-[10px] h-7"
                            >
                              {isMatching[report.id] ? "Matching..." : "Match"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
