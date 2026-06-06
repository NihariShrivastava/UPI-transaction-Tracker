import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, AlertTriangle, Calendar, X, Users, Download, ChevronDown, ChevronUp, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  onAddRemark?: (id: number, remark: string) => Promise<void>;
  onMatchReport?: (id: number) => Promise<boolean>;
  onOpenDuplicateDetails?: (report: any) => void;
  uploadMetrics?: {
    byCounter: Record<string, number>;
    byStore: Record<string, number>;
    byAdmin: number;
  };
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
  onAddRemark,
  onMatchReport,
  onOpenDuplicateDetails,
  uploadMetrics
}: AdminReportsTabProps) {
  const reportsDateInputRef = useRef<HTMLInputElement>(null);
  const [tempFilterDate, setTempFilterDate] = useState(reportsFilterDate);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [selectedCounterForStores, setSelectedCounterForStores] = useState<any | null>(null);
  const [selectedCounterFilter, setSelectedCounterFilter] = useState<string[]>([]);
  const [isCounterFilterOpen, setIsCounterFilterOpen] = useState(false);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string[]>([]);
  const [isStoreFilterOpen, setIsStoreFilterOpen] = useState(false);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [remarkingReportId, setRemarkingReportId] = useState<number | null>(null);
  const [editUpiId, setEditUpiId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMatching, setIsMatching] = useState<{ [key: number]: boolean }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  const filteredGroupedReportsByCounter = useMemo(() => {
    if (!globalSearch.trim()) return groupedReportsByCounter;
    const lower = globalSearch.toLowerCase();
    return groupedReportsByCounter.map(g => {
      const isCounterMatch = String(g.username || '').toLowerCase().includes(lower);
      
      const newStoreGroups: any = {};
      let newTotalAmount = 0;
      let newReports: any[] = [];

      if (g.storeGroups) {
        Object.entries(g.storeGroups).forEach(([storeId, storeGroup]: [string, any]) => {
          const isStoreMatch = String(storeId || '').toLowerCase().includes(lower);
          
          const filteredStoreReports = storeGroup.reports.filter((r: any) => 
            isCounterMatch || isStoreMatch ||
            String(r.upi_id || '').toLowerCase().includes(lower) || 
            String(r.amount || '').includes(lower)
          );

          if (filteredStoreReports.length > 0) {
            const storeTotal = filteredStoreReports.reduce((sum: number, r: any) => sum + Number(r.amount), 0);
            newStoreGroups[storeId] = {
              ...storeGroup,
              reports: filteredStoreReports,
              totalAmount: storeTotal
            };
            newTotalAmount += storeTotal;
            newReports = [...newReports, ...filteredStoreReports];
          }
        });
      } else {
        newReports = g.reports.filter((r: any) => 
          isCounterMatch ||
          String(r.upi_id || '').toLowerCase().includes(lower) || 
          String(r.amount || '').includes(lower)
        );
        newTotalAmount = newReports.reduce((sum: number, r: any) => sum + Number(r.amount), 0);
      }

      return { 
        ...g, 
        reports: newReports,
        storeGroups: Object.keys(newStoreGroups).length > 0 ? newStoreGroups : g.storeGroups,
        totalAmount: newTotalAmount
      };
    }).filter(g => g.reports.length > 0);
  }, [groupedReportsByCounter, globalSearch]);

  const filteredReportsData = useMemo(() => {
    if (!globalSearch.trim()) return reportsData;
    const lower = globalSearch.toLowerCase();
    return reportsData.filter((r: any) => 
      String(r.upi_id || '').toLowerCase().includes(lower) || 
      String(r.amount || '').includes(lower) ||
      String(r.details?.admin_store_name || '').toLowerCase().includes(lower) ||
      String(r.details?.admin_store_id || '').toLowerCase().includes(lower) ||
      String(r.details?.counter_name || '').toLowerCase().includes(lower) ||
      String(r.users?.counter_name || '').toLowerCase().includes(lower) ||
      String(r.users?.username || '').toLowerCase().includes(lower)
    );
  }, [reportsData, globalSearch]);

  useEffect(() => {
    setTempFilterDate(reportsFilterDate);
  }, [reportsFilterDate]);

  const handleNextSlide = () => {
    nextSlide();
    setSelectedCounterForStores(null);
  };

  const handlePrevSlide = () => {
    prevSlide();
    setSelectedCounterForStores(null);
  };

  const handleApplyDate = () => {
    setReportsFilterDate(tempFilterDate);
  };

  const handleClearDate = () => {
    setTempFilterDate('');
    setReportsFilterDate('');
    setSelectedCounterForStores(null);
    setSelectedCounterFilter([]);
    setIsCounterFilterOpen(false);
    setSelectedStoreFilter([]);
    setIsStoreFilterOpen(false);
    setGlobalSearch('');
  };

  const handleDownloadExcel = () => {
    let exportData: any[] = [];
    let filename = 'Report.xlsx';

    if (currentSlide === 0) {
      filename = 'Missing_in_Admin_Report.xlsx';
      filteredGroupedReportsByCounter
        .filter(g => selectedCounterFilter.length === 0 || selectedCounterFilter.includes(g.username))
        .forEach((group: any) => {
          group.reports.forEach((r: any) => {
            exportData.push({
              'Counter Name': group.counterName,
              'UPI ID / Cheque No': r.upi_id,
              'Amount': r.amount,
              'Date': r.date || reportsFilterDate || new Date().toISOString().split('T')[0],
              'Type': 'Missing in Admin',
              'Details': r.details?.message || ''
            });
          });
        });
    } else if (currentSlide === 1) {
      filename = 'Missing_in_Counter_Report.xlsx';
      filteredReportsData
        .filter((r) => {
          if (selectedStoreFilter.length > 0) {
             const storeName = r.details?.admin_store_name || 'Unassigned Mismatches';
             return selectedStoreFilter.includes(storeName);
          }
          return true;
        })
        .forEach(r => {
          exportData.push({
            'Store Name': r.details?.admin_store_name || 'Unassigned',
            'UPI ID / UTR': r.upi_id,
            'Amount': r.amount,
            'Date': r.date || reportsFilterDate || new Date().toISOString().split('T')[0],
            'Type': 'Missing in Counter',
            'Details': r.details?.message || ''
          });
        });
    } else if (currentSlide === 2) {
      filename = 'Duplicate_Entries_Report.xlsx';
      filteredReportsData.forEach(r => {
        exportData.push({
          'Counter Name': r.details?.counter_name || r.users?.counter_name || 'Admin',
          'UPI ID / Ref': r.upi_id,
          'Amount': r.amount,
          'Date': r.date || reportsFilterDate || new Date().toISOString().split('T')[0],
          'Type': 'Duplicate',
          'Details': r.details?.message || ''
        });
      });
    }

    if (exportData.length === 0) {
      setErrorMessage("No data available to download for this report.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, filename);
  };

  const groupedMissingInCounter = useMemo(() => {
    if (currentSlide !== 1) return [];
    
    const groups: { [key: string]: { storeName: string; storeId: string; reports: any[]; totalAmount: number } } = {};
    
    filteredReportsData.forEach(r => {
      const sName = r.details?.admin_store_name || '';
      const sId = r.details?.admin_store_id || '';
      
      let storeNameDisplay = 'Unassigned Mismatches';
      let storeIdDisplay = 'Pending Upload';
      let key = 'unassigned';
      
      if (sName || sId) {
        storeNameDisplay = sName || 'Unknown Store';
        storeIdDisplay = sId || 'Unknown ID';
        key = `${storeNameDisplay}_${storeIdDisplay}`;
      }
      
      if (!groups[key]) {
        groups[key] = {
          storeName: storeNameDisplay,
          storeId: storeIdDisplay,
          reports: [],
          totalAmount: 0
        };
      }
      
      groups[key].reports.push(r);
      groups[key].totalAmount += Number(r.amount);
    });
    
    return Object.values(groups);
  }, [reportsData, currentSlide]);

  const uniqueCountersForFilter = useMemo(() => {
    return Array.from(new Set(groupedReportsByCounter.map(g => g.username))).filter(Boolean);
  }, [groupedReportsByCounter]);

  const uniqueStoresForFilter = useMemo(() => {
    return Array.from(new Set(groupedMissingInCounter.map((g: any) => g.storeName))).filter(Boolean);
  }, [groupedMissingInCounter]);

  const overviewSlide0 = useMemo(() => {
    if (currentSlide !== 0) return [];
    return groupedReportsByCounter.map(g => ({
      name: g.username,
      uploaded: uploadMetrics?.byCounter[g.username] || 0,
      discrepancies: g.reports.length,
      matched: g.reports.filter((r: any) => r.details?.is_edited && !r.details?.is_failed_match).length
    }));
  }, [groupedReportsByCounter, currentSlide, uploadMetrics]);

  const overviewSlide1 = useMemo(() => {
    if (currentSlide !== 1) return [];
    return groupedMissingInCounter.map((g: any) => ({
      name: g.storeName === 'Unassigned Mismatches' ? 'Unassigned Mismatches' : `${g.storeName} - ${g.storeId}`,
      uploaded: uploadMetrics?.byStore[g.storeName === 'Unassigned Mismatches' ? 'Unassigned Mismatches' : `${g.storeName} - ${g.storeId}`] || 0,
      discrepancies: g.reports.length,
      matched: g.reports.filter((r: any) => r.details?.is_edited && !r.details?.is_failed_match).length
    }));
  }, [groupedMissingInCounter, currentSlide, uploadMetrics]);

  const overviewSlide2 = useMemo(() => {
    if (currentSlide !== 2) return [];
    const groups: { [key: string]: { name: string, uploaded: number, discrepancies: number, matched: number } } = {};
    
    filteredReportsData.forEach(r => {
      let name = 'Counter ' + (r.counter_id || 'Unknown');
      let uploaded = 0;
      if (r.details?.source === 'admin') {
        name = 'Admin Sheet';
        uploaded = uploadMetrics?.byAdmin || 0;
      } else if (r.details?.source === 'counter') {
         name = r.users?.counter_name || `Counter ${r.counter_id}`;
         uploaded = uploadMetrics?.byCounter[r.users?.username] || 0; // fallback logic
      }
      
      if (!groups[name]) groups[name] = { name, uploaded, discrepancies: 0, matched: 0 };
      groups[name].discrepancies += 1;
      if (r.details?.is_edited && !r.details?.is_failed_match) {
        groups[name].matched += 1;
      }
    });
    return Object.values(groups);
  }, [reportsData, currentSlide, uploadMetrics]);

  const currentOverviewData = currentSlide === 0 ? overviewSlide0 : currentSlide === 1 ? overviewSlide1 : overviewSlide2;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Slider Navigation Header */}
      <div className="bg-[#111111] border-y border-[#222222] flex items-center justify-between p-4 rounded-2xl shadow-lg">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handlePrevSlide} 
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
          onClick={handleNextSlide} 
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
          
          <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
            
            <div className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 focus-within:border-purple-500/50 transition-colors w-full sm:w-64">
              <Search className="w-4 h-4 text-purple-400 shrink-0" />
              <input 
                type="text" 
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Search UTR, Amount, Store..."
                className="bg-transparent text-xs text-white focus:outline-none w-full"
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch('')} className="text-text-secondary hover:text-white shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
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

            {(reportsFilterDate || selectedCounterFilter.length > 0 || selectedStoreFilter.length > 0) && (
              <Button
                onClick={handleClearDate}
                variant="ghost"
                className="text-text-secondary hover:text-white font-bold text-xs px-3 h-[34px] rounded-xl"
              >
                Clear
              </Button>
            )}

            {currentSlide === 0 && uniqueCountersForFilter.length > 0 && (
              <div className="relative ml-2 z-50">
                <Button 
                  onClick={() => setIsCounterFilterOpen(!isCounterFilterOpen)}
                  variant="secondary" 
                  className="bg-[#000000] border border-[#222222] text-xs h-[34px] rounded-xl text-white px-3 focus:border-purple-500 hover:border-purple-500/50 flex items-center gap-1"
                >
                  <span>{selectedCounterFilter.length > 0 ? `${selectedCounterFilter.length} Counters Selected` : 'All Counters'}</span>
                  {isCounterFilterOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                </Button>
                
                {isCounterFilterOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsCounterFilterOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[#111111] border border-[#222222] rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto p-2">
                      <label className="flex items-center gap-2 p-2 hover:bg-[#222222] rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedCounterFilter.length === 0}
                          onChange={() => setSelectedCounterFilter([])}
                          className="rounded border-[#333333] bg-[#000000] text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-xs text-white font-semibold">All Counters</span>
                      </label>
                      <div className="h-px bg-[#222222] my-1" />
                      {uniqueCountersForFilter.map((c: any) => (
                        <label key={c} className="flex items-center gap-2 p-2 hover:bg-[#222222] rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={selectedCounterFilter.includes(c)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCounterFilter([...selectedCounterFilter, c]);
                              } else {
                                setSelectedCounterFilter(selectedCounterFilter.filter(x => x !== c));
                              }
                            }}
                            className="rounded border-[#333333] bg-[#000000] text-purple-500 focus:ring-purple-500 shrink-0"
                          />
                          <span className="text-xs text-white truncate" title={c}>{c}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {currentSlide === 1 && uniqueStoresForFilter.length > 0 && (
              <div className="relative ml-2 z-50">
                <Button 
                  onClick={() => setIsStoreFilterOpen(!isStoreFilterOpen)}
                  variant="secondary" 
                  className="bg-[#000000] border border-[#222222] text-xs h-[34px] rounded-xl text-white px-3 focus:border-purple-500 hover:border-purple-500/50 flex items-center gap-1"
                >
                  <span>{selectedStoreFilter.length > 0 ? `${selectedStoreFilter.length} Stores Selected` : 'All Store Names'}</span>
                  {isStoreFilterOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                </Button>
                
                {isStoreFilterOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsStoreFilterOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[#111111] border border-[#222222] rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto p-2">
                      <label className="flex items-center gap-2 p-2 hover:bg-[#222222] rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedStoreFilter.length === 0}
                          onChange={() => setSelectedStoreFilter([])}
                          className="rounded border-[#333333] bg-[#000000] text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-xs text-white font-semibold">All Store Names</span>
                      </label>
                      <div className="h-px bg-[#222222] my-1" />
                      {uniqueStoresForFilter.map((s: any) => (
                        <label key={s} className="flex items-center gap-2 p-2 hover:bg-[#222222] rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={selectedStoreFilter.includes(s)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStoreFilter([...selectedStoreFilter, s]);
                              } else {
                                setSelectedStoreFilter(selectedStoreFilter.filter(x => x !== s));
                              }
                            }}
                            className="rounded border-[#333333] bg-[#000000] text-purple-500 focus:ring-purple-500 shrink-0"
                          />
                          <span className="text-xs text-white truncate" title={s}>{s}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={() => setIsOverviewOpen(!isOverviewOpen)}
              variant="secondary"
              className="bg-[#222222] hover:bg-[#333333] text-white font-bold text-xs px-4 h-[34px] rounded-xl transition-all flex items-center gap-2 ml-2"
            >
              Overview {isOverviewOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>

            <Button
              onClick={handleDownloadExcel}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs px-4 h-[34px] rounded-xl transition-all flex items-center gap-2 ml-2"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {isOverviewOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-[#151515] border border-[#222222] rounded-2xl p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-[#222222]">
                      <TableHead>{currentSlide === 1 ? 'Store Name' : 'Counter Name'}</TableHead>
                      <TableHead className="text-right">Total Uploaded</TableHead>
                      <TableHead className="text-right">Discrepancies</TableHead>
                      <TableHead className="text-right">Matched Cases</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOverviewData.length === 0 ? (
                       <TableRow>
                         <TableCell colSpan={4} className="text-center text-text-secondary py-4">No data available.</TableCell>
                       </TableRow>
                    ) : currentOverviewData.map((stat, idx) => (
                      <TableRow key={idx} className="border-b border-[#222222]/50 hover:bg-[#222222]/20">
                        <TableCell className="font-bold text-white">{stat.name}</TableCell>
                        <TableCell className="text-right text-text-secondary font-mono">{stat.uploaded}</TableCell>
                        <TableCell className="text-right text-orange-400 font-mono font-semibold">{stat.discrepancies}</TableCell>
                        <TableCell className="text-right text-emerald-400 font-mono font-semibold">{stat.matched}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  {filteredReportsData.length} {currentSlide === 1 ? 'Cards Mismatched' : 'Duplicate Entries'}
                </span>
              </div>
            )}
            {currentSlide === 0 ? (
              /* Slide 0: Missing in Admin (Grouped by Counter Cards) */
              (() => {
                const activeCounter = selectedCounterForStores 
                  ? (filteredGroupedReportsByCounter.find(g => g.counterId === selectedCounterForStores.counterId) || selectedCounterForStores)
                  : null;

                return activeCounter ? (
                  <div>
                    <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-left-4">
                      <Button variant="ghost" onClick={() => setSelectedCounterForStores(null)} className="text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl px-4 py-2">
                        <ChevronLeft className="w-5 h-5 mr-1" /> Back to Counters
                      </Button>
                      <h3 className="text-xl font-bold text-white">Store IDs for {activeCounter.username}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                      {Object.values(activeCounter.storeGroups || {}).map((storeGroup: any, idx: number) => (
                        <motion.div
                          key={`store_${idx}`}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -6, scale: 1.02 }}
                          onClick={() => onOpenGroupDetails({
                            counterId: activeCounter.counterId,
                            counterName: storeGroup.storeId,
                            reports: storeGroup.reports,
                            totalAmount: storeGroup.totalAmount
                          })}
                          className="group relative bg-gradient-to-br from-[#161616] to-[#0d0d0d] border border-[#222222] hover:border-purple-500/40 p-6 rounded-2xl transition-all duration-300 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between"
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <span className="inline-flex items-center justify-center p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                                <Users className="w-5 h-5" />
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                Store ID
                              </span>
                            </div>
                            <h4 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                              {storeGroup.storeId}
                            </h4>
                            <p className="text-xs text-text-secondary mt-2">
                              Discrepancy: <span className="text-white font-bold">{storeGroup.reports.length} items</span> completely missing in Admin spreadsheet.
                            </p>
                          </div>
                          <div className="mt-6 pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                            <span className="text-sm font-mono text-purple-400 font-bold">
                              ₹{storeGroup.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-purple-400 group-hover:underline font-bold transition-all flex items-center gap-1">
                              Inspect details <span>→</span>
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                    {filteredGroupedReportsByCounter
                    .filter(g => selectedCounterFilter.length === 0 || selectedCounterFilter.includes(g.username))
                    .map((group, idx) => (
                    <motion.div
                      key={`${group.counterId || 'unknown'}_${idx}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -6, scale: 1.02 }}
                      onClick={() => setSelectedCounterForStores(group)}
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
                          {group.username}
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
                          View Store IDs <span>→</span>
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                );
              })()
            ) : (
              /* Slide 1 & 2: Render individual cards */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                {filteredReportsData
                  .filter((report) => {
                    if (currentSlide === 1 && selectedStoreFilter.length > 0) {
                      const storeName = report.details?.admin_store_name || 'Unassigned Mismatches';
                      return selectedStoreFilter.includes(storeName);
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    const aEdited = a.details?.is_edited === true;
                    const bEdited = b.details?.is_edited === true;
                    if (aEdited && !bEdited) return -1;
                    if (!aEdited && bEdited) return 1;
                    return 0;
                  })
                  .map((report) => {
                  const isEditing = editingReportId === report.id;
                  const isRemarking = remarkingReportId === report.id;
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
                          {currentSlide === 1 && (
                            <div className="mt-2 flex flex-col gap-1">
                              <span className="inline-flex max-w-fit px-2 py-1 rounded-md bg-[#222222] text-xs font-bold text-white border border-[#333333]">
                                Store: {report.details?.admin_store_name || 'Unassigned'}
                              </span>
                              {(report.details?.admin_store_id && report.details?.admin_store_id !== 'Unknown ID') && (
                                <span className="inline-flex max-w-fit px-2 py-1 rounded-md bg-[#1a1a1a] text-[10px] text-text-secondary border border-[#2a2a2a]">
                                  ID: {report.details.admin_store_id}
                                </span>
                              )}
                            </div>
                          )}
                          {report.details?.admin_remark && (
                            <div className="mt-3 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              <p className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold mb-1">Admin Remark</p>
                              <p className="text-xs text-white leading-relaxed">{report.details.admin_remark}</p>
                            </div>
                          )}
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
                      ) : isRemarking ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editRemark}
                            onChange={e => setEditRemark(e.target.value)}
                            placeholder="Type remark..."
                            className="w-[120px] bg-[#000000] border border-blue-500/50 focus:border-blue-500 rounded-lg h-7 px-2 text-[10px] text-white focus:outline-none transition-all"
                            autoFocus
                            onClick={e => e.stopPropagation()}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                setIsSaving(true);
                                try {
                                  if (onAddRemark) await onAddRemark(report.id, editRemark);
                                  setRemarkingReportId(null);
                                } finally {
                                  setIsSaving(false);
                                }
                              }
                            }}
                          />
                          <Button 
                            variant="primary" 
                            size="sm" 
                            disabled={isSaving}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setIsSaving(true);
                              try {
                                if (onAddRemark) await onAddRemark(report.id, editRemark);
                                setRemarkingReportId(null);
                              } finally {
                                setIsSaving(false);
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-[10px] h-7 px-2"
                          >
                            {isSaving ? "..." : "Save"}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            disabled={isSaving}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemarkingReportId(null);
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-semibold rounded-lg text-[10px] h-7 px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {onAddRemark && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemarkingReportId(report.id);
                                setEditRemark(report.details?.admin_remark || "");
                              }}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 font-semibold rounded-lg text-[10px] h-7"
                            >
                              Remark
                            </Button>
                          )}
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
