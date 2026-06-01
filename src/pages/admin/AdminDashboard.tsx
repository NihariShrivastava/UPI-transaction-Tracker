import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, Upload, AlertTriangle, X, CheckCircle2, Loader2 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { supabase } from '../../lib/supabase';

// Modular subcomponents
import AdminHeader from './components/AdminHeader';
import ControlModules from './components/ControlModules';
import AdminManageCounters from './components/AdminManageCounters';
import AdminReportsTab from './components/AdminReportsTab';
import AdminBacklogTab from './components/AdminBacklogTab';
import { AddCounterModal, ReportGroupDetailsModal, BatchDetailsModal, DuplicateDetailsModal } from './components/AdminModals';

// Fuzzy synonym matching for Excel columns
const findHeaderKey = (row: any, synonyms: string[]): string | null => {
  const keys = Object.keys(row);
  for (const syn of synonyms) {
    const found = keys.find(
      k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === syn.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (found) return found;
  }
  return null;
};

// Robust date parser (handles JS Date objects, Excel date serials, and string formats)
const parseExcelDate = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch (e) {}
  return str;
};

// Robust currency/amount cleaner
const parseExcelAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^\d\.]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'manage' | 'upload' | 'reports' | 'backlog'>('home');
  
  // Add Counter Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Slider State
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ['Missing in Admin', 'Missing in Counter', 'Duplicate UPI IDs', 'Overview'];

  // Live Excel Upload State (Admin)
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminStatus, setAdminStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live Reports Slider state
  const [reportsFilterDate, setReportsFilterDate] = useState('');
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Live Backlog upload logs state
  const [backlogStartDate, setBacklogStartDate] = useState('');
  const [backlogEndDate, setBacklogEndDate] = useState('');
  const [counterUploads, setCounterUploads] = useState<any[]>([]);
  const [adminUploads, setAdminUploads] = useState<any[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(false);
  const [backlogSubTab, setBacklogSubTab] = useState<'counter' | 'admin'>('counter');

  // Batch details modal state
  const [selectedDetailBatch, setSelectedDetailBatch] = useState<{
    counter_id: number | null;
    counter_name: string;
    date: string;
    source: 'counter' | 'admin';
  } | null>(null);
  const [batchDetailsData, setBatchDetailsData] = useState<any[]>([]);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);
  const [batchDetailsSearch, setBatchDetailsSearch] = useState('');

  // Selected report counter group details modal state
  const [selectedReportCounterGroup, setSelectedReportCounterGroup] = useState<{
    counterId: number | null;
    counterName: string;
    reports: any[];
    totalAmount: number;
  } | null>(null);

  // Selected backlog counter details panel state
  const [selectedBacklogCounter, setSelectedBacklogCounter] = useState<any | null>(null);

  // Selected duplicate report for details modal
  const [selectedDuplicateReport, setSelectedDuplicateReport] = useState<any | null>(null);

  // Global Dashboard Statistics States
  const [totalDiscrepancies, setTotalDiscrepancies] = useState(0);
  const [totalExcelEntries, setTotalExcelEntries] = useState(0);

  // Overview Data State
  const [overviewData, setOverviewData] = useState<any[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Group reportsData by Counter dynamically for Slide 0
  const groupedReportsByCounter = useMemo(() => {
    if (currentSlide !== 0) return [];
    
    const groups: { [key: string]: { counterId: number | null; counterName: string; reports: any[]; totalAmount: number } } = {};
    
    reportsData.forEach(r => {
      const cId = r.counter_id;
      const cName = r.details?.counter_name || r.users?.counter_name || `Counter ${cId || 'Unknown'}`;
      const key = cId ? String(cId) : 'unknown';
      
      if (!groups[key]) {
        groups[key] = {
          counterId: cId,
          counterName: cName,
          reports: [],
          totalAmount: 0
        };
      }
      groups[key].reports.push(r);
      groups[key].totalAmount += Number(r.amount);
    });
    
    return Object.values(groups);
  }, [reportsData, currentSlide]);

  const fetchCounters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'counter')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching counters:', error);
      } else if (data) {
        setCounters(data.map((user: any) => ({
          id: user.id,
          name: user.counter_name || user.username,
          username: user.username,
          password: user.password,
          logins: user.logins || 0,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch counters:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestDate = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        // Keep initial filters empty so all entries are visible on first load
        // setReportsFilterDate(data[0].date);
        // setBacklogFilterDate(data[0].date);
      }
    } catch (e) {
      console.error('Failed to fetch latest data date:', e);
    }
  };

  const fetchSystemMetrics = async () => {
    try {
      const { count: reportsCount, error: reportsErr } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true });

      if (!reportsErr && reportsCount !== null) {
        setTotalDiscrepancies(reportsCount);
      }

      const { count: txCount, error: txErr } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      if (!txErr && txCount !== null) {
        setTotalExcelEntries(txCount);
      }
    } catch (e) {
      console.error('Error fetching dashboard statistics:', e);
    }
  };

  const fetchOverviewData = async () => {
    if (activeTab !== 'reports' || currentSlide !== 3) return;
    
    setOverviewLoading(true);
    try {
      let txQuery = supabase.from('transactions').select('counter_id, source');
      if (reportsFilterDate) txQuery = txQuery.eq('date', reportsFilterDate);
      
      let repQuery = supabase.from('reports').select('counter_id, type');
      if (reportsFilterDate) repQuery = repQuery.eq('date', reportsFilterDate);
      
      const [txRes, repRes] = await Promise.all([txQuery, repQuery]);
      
      if (txRes.error || repRes.error) throw new Error('Failed to fetch overview data');
      
      const stats = counters.map(counter => {
        const uploaded = (txRes.data || []).filter(t => t.source === 'counter' && t.counter_id === counter.id).length;
        const missingInAdmin = (repRes.data || []).filter(r => r.type === 'missing_in_admin' && r.counter_id === counter.id).length;
        const duplicateUpi = (repRes.data || []).filter(r => r.type === 'duplicate_upi' && r.counter_id === counter.id).length;
        
        const discrepancies = missingInAdmin + duplicateUpi;
        const matched = uploaded - discrepancies;
        
        return {
          counterId: counter.id,
          counterName: counter.name,
          uploaded,
          discrepancies,
          matched: matched > 0 ? matched : 0
        };
      });
      
      setOverviewData(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchCounters();
    fetchLatestDate();
    fetchSystemMetrics();
  }, []);

  useEffect(() => {
    if (activeTab === 'reports' && currentSlide === 3) {
      fetchOverviewData();
    }
  }, [activeTab, currentSlide, reportsFilterDate, counters]);

  const fetchReports = async () => {
    if (currentSlide === 3) return; // Overview slide doesn't use reportsData
    
    try {
      setReportsLoading(true);
      const reportType = currentSlide === 0 
        ? 'missing_in_admin' 
        : currentSlide === 1 
        ? 'missing_in_counter' 
        : 'duplicate_upi';

      let query = supabase
        .from('reports')
        .select('*, users(counter_name)')
        .eq('type', reportType);

      if (reportsFilterDate) {
        query = query.eq('date', reportsFilterDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching reports:', error);
      } else {
        setReportsData(data || []);
        setSelectedReportCounterGroup((prev) => {
          if (!prev) return null;
          const updatedReports = (data || []).filter((r: any) => r.counter_id === prev.counterId);
          if (updatedReports.length === 0) return null;
          const updatedTotal = updatedReports.reduce((sum: number, r: any) => sum + Number(r.amount), 0);
          return {
            ...prev,
            reports: updatedReports,
            totalAmount: updatedTotal
          };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReportsLoading(false);
      fetchSystemMetrics();
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportsFilterDate, currentSlide, activeTab]);

  // Group transactions dynamically from the database to represent history uploads
  const fetchBacklogHistory = async () => {
    try {
      setBacklogLoading(true);
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*, users(counter_name)');

      if (error) {
        console.error('Error fetching backlog transactions:', error);
        return;
      }

      // Group by Counter ID first
      const counterMap: { [key: number]: { counterId: number; counterName: string; uploads: { date: string; count: number }[]; totalCount: number } } = {};
      const adminGroup: { [key: string]: any } = {};

      txs?.forEach((t: any) => {
        if (t.source === 'counter' && t.counter_id) {
          const cId = t.counter_id;
          const cName = t.users?.counter_name || `Counter ${cId}`;
          
          if (!counterMap[cId]) {
            counterMap[cId] = {
              counterId: cId,
              counterName: cName,
              uploads: [],
              totalCount: 0
            };
          }
          
          counterMap[cId].totalCount++;
          
          // Add to uploads date
          let dateUpload = counterMap[cId].uploads.find(u => u.date === t.date);
          if (!dateUpload) {
            dateUpload = { date: t.date, count: 0 };
            counterMap[cId].uploads.push(dateUpload);
          }
          dateUpload.count++;
        } else if (t.source === 'admin') {
          const key = t.date;
          if (!adminGroup[key]) {
            adminGroup[key] = {
              date: t.date,
              count: 0
            };
          }
          adminGroup[key].count++;
        }
      });

      // Sort dates for each counter descending
      const counterList = Object.values(counterMap).map(c => {
        c.uploads.sort((a, b) => b.date.localeCompare(a.date));
        return c;
      }).sort((a, b) => a.counterName.localeCompare(b.counterName));

      setCounterUploads(counterList);
      setAdminUploads(Object.values(adminGroup).sort((a, b) => b.date.localeCompare(a.date)));

      // Also dynamically update the active selectedBacklogCounter if it was opened
      setSelectedBacklogCounter((prev: any) => {
        if (!prev) return null;
        const currentUpdated = counterList.find(c => c.counterId === prev.counterId);
        return currentUpdated || null;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setBacklogLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'backlog') {
      fetchBacklogHistory();
    }
  }, [activeTab]);

  // Fetch batch details when a batch is clicked
  useEffect(() => {
    const fetchBatchDetails = async () => {
      if (!selectedDetailBatch) {
        setBatchDetailsData([]);
        setBatchDetailsSearch('');
        return;
      }
      try {
        setBatchDetailsLoading(true);
        let query = supabase
          .from('transactions')
          .select('*')
          .eq('date', selectedDetailBatch.date)
          .eq('source', selectedDetailBatch.source);

        if (selectedDetailBatch.source === 'counter' && selectedDetailBatch.counter_id) {
          query = query.eq('counter_id', selectedDetailBatch.counter_id);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Error fetching batch details:', error);
        } else {
          setBatchDetailsData(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setBatchDetailsLoading(false);
      }
    };

    fetchBatchDetails();
  }, [selectedDetailBatch]);

  // STRICT THREE-WAY RECONCILIATION ENGINE
  const compareTransactionsForDates = async (dates: string[]) => {
    for (const date of dates) {
      try {
        const targetDateObj = new Date(date);
        const startDate = new Date(targetDateObj);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(targetDateObj);
        endDate.setDate(endDate.getDate() + 3);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const { data: windowTxs, error: txError } = await supabase
          .from('transactions')
          .select('*, users(counter_name)')
          .gte('date', startStr)
          .lte('date', endStr);

        if (txError || !windowTxs) {
          console.error(`Error fetching transactions for comparison on ${date}:`, txError?.message);
          continue;
        }

        const targetTxs = windowTxs.filter(t => t.date === date);
        const targetAdminTxs = targetTxs.filter(t => t.source === 'admin');
        const targetCounterTxs = targetTxs.filter(t => t.source === 'counter');

        // Fetch existing reports to preserve UI state (is_edited, is_failed_match)
        const { data: existingReports } = await supabase
          .from('reports')
          .select('upi_id, details')
          .eq('date', date);

        const preservedState: Record<string, { is_edited?: boolean, is_failed_match?: boolean }> = {};
        if (existingReports) {
          existingReports.forEach(r => {
            if (r.details?.is_edited || r.details?.is_failed_match) {
              preservedState[r.upi_id] = {
                is_edited: r.details.is_edited,
                is_failed_match: r.details.is_failed_match
              };
            }
          });
        }

        // Clear pre-existing reports to prevent drift/overlap
        await supabase
          .from('reports')
          .delete()
          .eq('date', date);

        // STRICT REQUIREMENT: If admin has not uploaded transactions for this date yet,
        // do not run reconciliation or generate any discrepancy reports.
        if (targetAdminTxs.length === 0) {
          continue;
        }

        const counterTxsWindow = windowTxs.filter(t => t.source === 'counter');
        const adminTxsWindow = windowTxs.filter(t => t.source === 'admin');

        const reportsToInsert: any[] = [];

        // Group counter transactions by exact normalized Cheque No
        const counterMap = new Map<string, any[]>();
        const counterLast10Map = new Map<string, any[]>();
        counterTxsWindow.forEach(t => {
          const keys = String(t.upi_id).split(',');
          keys.forEach(rawKey => {
            let key = rawKey.trim().toLowerCase();
            if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
            if (!counterMap.has(key)) counterMap.set(key, []);
            counterMap.get(key)!.push(t);
            
            if (key.length >= 10) {
              const last10 = key.slice(-10);
              if (!counterLast10Map.has(last10)) counterLast10Map.set(last10, []);
              counterLast10Map.get(last10)!.push(t);
            }
          });
        });

        // Group admin transactions by exact UTR and last 10 digits
        const adminExactMap = new Map<string, any[]>();
        const adminLast10Map = new Map<string, any[]>();
        adminTxsWindow.forEach(t => {
          const keys = String(t.upi_id).split(',');
          keys.forEach(rawKey => {
            let key = rawKey.trim().toLowerCase();
            if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
            
            if (!adminExactMap.has(key)) adminExactMap.set(key, []);
            adminExactMap.get(key)!.push(t);
            
            if (key.length >= 10) {
              const last10 = key.slice(-10);
              if (!adminLast10Map.has(last10)) adminLast10Map.set(last10, []);
              adminLast10Map.get(last10)!.push(t);
            }
          });
        });

        // Check duplicate Cheque Numbers in Counter sheets
        for (const [, list] of counterMap.entries()) {
          const targetList = list.filter(t => t.date === date);
          if (targetList.length > 0 && list.length > 1) {
            // Push one report per target transaction
            targetList.forEach(t => {
              // Ensure we don't push the exact same report twice if a transaction has multiple identifiers
              if (!reportsToInsert.find(r => r.type === 'duplicate_upi' && r.upi_id === t.upi_id && r.source_id === t.id)) {
                reportsToInsert.push({
                  date,
                  type: 'duplicate_upi',
                  upi_id: t.upi_id,
                  amount: t.amount,
                  counter_id: t.counter_id,
                  source_id: t.id,
                  details: {
                    source: 'counter',
                    count: list.length,
                    message: `Duplicate Cheque Number '${t.upi_id}' loaded in Counter '${t.users?.counter_name || 'Unknown'}' (${list.length} records)`
                  }
                });
              }
            });
          }
        }

        // Check duplicate Transaction UTRs in Admin sheets
        for (const [, list] of adminExactMap.entries()) {
          const targetList = list.filter(t => t.date === date);
          if (targetList.length > 0 && list.length > 1) {
            targetList.forEach(t => {
              if (!reportsToInsert.find(r => r.type === 'duplicate_upi' && r.upi_id === t.upi_id && r.source_id === t.id)) {
                reportsToInsert.push({
                  date,
                  type: 'duplicate_upi',
                  upi_id: t.upi_id,
                  amount: t.amount,
                  counter_id: null,
                  source_id: t.id,
                  details: {
                    source: 'admin',
                    count: list.length,
                    message: `Duplicate Transaction UTR '${t.upi_id}' loaded in Admin sheet (${list.length} records)`
                  }
                });
              }
            });
          }
        }

        // strict validation: missing in admin or amount discrepancies
        targetCounterTxs.forEach(c => {
          const keys = String(c.upi_id).split(',').map(k => {
            let key = k.trim().toLowerCase();
            if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
            return key;
          });

          let matchedAdminList: any[] | undefined = undefined;

          for (const cKey of keys) {
            let aList = adminExactMap.get(cKey);
            if (!aList && cKey.length >= 10) {
              aList = adminLast10Map.get(cKey.slice(-10));
            }
            if (aList) {
              matchedAdminList = aList;
              break;
            }
          }

          if (!matchedAdminList) {
            // Missing in Admin completely
            reportsToInsert.push({
              date,
              type: 'missing_in_admin',
              upi_id: c.upi_id,
              amount: c.amount,
              counter_id: c.counter_id,
              details: {
                counter_name: c.users?.counter_name || 'Unknown',
                cheque_date: c.date,
                message: `Cheque Number '${c.upi_id}' is available in Counter but missing in Admin sheet.`
              }
            });
          } else {
            // Check strict match for amount
            const matchingAdmin = matchedAdminList.find(a => Number(a.amount) === Number(c.amount));
            if (!matchingAdmin) {
              reportsToInsert.push({
                date,
                type: 'missing_in_admin',
                upi_id: c.upi_id,
                amount: c.amount,
                counter_id: c.counter_id,
                details: {
                  counter_name: c.users?.counter_name || 'Unknown',
                  cheque_amount: c.amount,
                  admin_amounts: matchedAdminList.map(a => a.amount),
                  message: `Cheque Number '${c.upi_id}' matched keys, but amount verification failed! Counter receipt: ${c.amount}, Admin UPI Amount: ${matchedAdminList.map(a => a.amount).join(', ')}`
                }
              });
            }
          }
        });

        // strict validation: missing in counter
        targetAdminTxs.forEach(a => {
          const keys = String(a.upi_id).split(',').map(k => {
            let key = k.trim().toLowerCase();
            if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
            return key;
          });

          let matchedCounterList: any[] | undefined = undefined;

          for (const aKey of keys) {
            let cList = counterMap.get(aKey);
            if (!cList && aKey.length >= 10) {
              cList = counterLast10Map.get(aKey.slice(-10));
            }
            if (cList) {
              matchedCounterList = cList;
              break;
            }
          }

          if (!matchedCounterList) {
            reportsToInsert.push({
              date,
              type: 'missing_in_counter',
              upi_id: a.upi_id,
              amount: a.amount,
              counter_id: null,
              details: {
                admin_amount: a.amount,
                transaction_date: a.date,
                message: `Transaction UTR '${a.upi_id}' is available in Admin but missing from all Counter sheets.`
              }
            });
          }
        });

        // Remove source_id and apply preserved state before inserting into database
        const finalReports = reportsToInsert.map(({ source_id, ...report }) => {
          const pState = preservedState[report.upi_id];
          if (pState) {
            return {
              ...report,
              details: {
                ...report.details,
                ...(pState.is_edited && { is_edited: true }),
                ...(pState.is_failed_match && { is_failed_match: true })
              }
            };
          }
          return report;
        });

        if (finalReports.length > 0) {
          await supabase.from('reports').insert(finalReports);
        }

      } catch (err) {
        console.error(`Comparison error for date ${date}:`, err);
      }
    }
  };

  const handleAddCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUsername && newPassword) {
      try {
        const { error } = await supabase
          .from('users')
          .insert([
            {
              role: 'counter',
              username: newUsername,
              password: newPassword,
              counter_name: newUsername,
              logins: 0,
            }
          ]);

        if (error) {
          alert('Error creating counter: ' + error.message);
        } else {
          setIsAddDialogOpen(false);
          setNewUsername('');
          setNewPassword('');
          fetchCounters();
        }
      } catch (err) {
        console.error('Error adding counter:', err);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this counter? All associated transactions and reports will also be deleted.')) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (error) {
          alert('Error deleting counter: ' + error.message);
        } else {
          fetchCounters();
        }
      } catch (err) {
        console.error('Error deleting counter:', err);
      }
    }
  };

  const handleEdit = async (id: number, currentUsername: string) => {
    const newUsername = prompt("Edit username for " + currentUsername, currentUsername);
    if (newUsername && newUsername.trim() !== '' && newUsername !== currentUsername) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ counter_name: newUsername, username: newUsername })
          .eq('id', id);

        if (error) {
          alert('Error updating counter: ' + error.message);
        } else {
          fetchCounters();
        }
      } catch (err) {
        console.error('Error editing counter:', err);
      }
    }
  };

  // ADMIN EXCEL FILE UPLOAD HANDLER
  const triggerAdminFileSelect = () => {
    adminFileInputRef.current?.click();
  };

  const handleAdminFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAdminStatus(null);
    setAdminUploading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data.');

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
        if (rows.length === 0) {
          throw new Error('The selected Admin Excel sheet is empty.');
        }

        // Fuzzy match required headers
        const phonepeSynonyms = ['phonepereferenceid', 'phonepeid', 'phonepe', 'phonepereference'];
        const utrSynonyms = ['transactionutr', 'utr', 'transactionid', 'upiid', 'chequeno', 'chequenumber', 'cheque_number', 'referenceno', 'refno'];
        const dateSynonyms = ['transactiondate', 'transaction_date', 'date', 'chequedate', 'cheque_date', 'uploaddate'];
        const amountSynonyms = ['upiamount', 'amount', 'receipt', 'receiptamount', 'receipt_amount', 'value'];

        const firstRow = rows[0];
        const phonepeKey = findHeaderKey(firstRow, phonepeSynonyms);
        const utrKey = findHeaderKey(firstRow, utrSynonyms);
        const dateKey = findHeaderKey(firstRow, dateSynonyms);
        const amountKey = findHeaderKey(firstRow, amountSynonyms);

        if ((!phonepeKey && !utrKey) || !dateKey || !amountKey) {
          throw new Error(
            `Header verification failed. Your Admin Excel must contain a PhonePe or UTR column, "Transaction Date" (found: ${dateKey ? 'Yes' : 'No'}), and "UPI Amount" (found: ${amountKey ? 'Yes' : 'No'}).`
          );
        }

        const transactionsToInsert: any[] = [];
        const uniqueDates = new Set<string>();

        rows.forEach((row) => {
          const identifiers = new Set<string>();
          
          if (phonepeKey && row[phonepeKey]) {
            let id = String(row[phonepeKey]).trim();
            if (id.endsWith('.0')) id = id.substring(0, id.length - 2);
            if (id) identifiers.add(id);
          }
          
          if (utrKey && row[utrKey]) {
            let id = String(row[utrKey]).trim();
            if (id.endsWith('.0')) id = id.substring(0, id.length - 2);
            if (id) identifiers.add(id);
          }

          const upiId = Array.from(identifiers).join(',');
          if (!upiId) return;

          const rawDate = row[dateKey];
          const rawAmount = row[amountKey];

          const dateStr = parseExcelDate(rawDate);
          const amountNum = parseExcelAmount(rawAmount);

          if (!dateStr) return;

          transactionsToInsert.push({
            upi_id: upiId,
            date: dateStr,
            amount: amountNum,
            source: 'admin',
            counter_id: null
          });

          uniqueDates.add(dateStr);
        });

        if (transactionsToInsert.length === 0) {
          throw new Error('No valid transaction rows found in the Admin spreadsheet.');
        }

        const dateArray = Array.from(uniqueDates);

        // Fetch existing admin transaction records for these dates to identify duplicates cleanly by primary key
        const { data: existingTxs, error: fetchError } = await supabase
          .from('transactions')
          .select('id, upi_id')
          .eq('source', 'admin')
          .in('date', dateArray);

        if (fetchError) {
          throw new Error(`Error checking for duplicate admin records: ${fetchError.message}`);
        }

        const incomingUpiIds = new Set(
          transactionsToInsert.map(t => String(t.upi_id).trim().toLowerCase())
        );

        const idsToDelete = existingTxs
          ? existingTxs
              .filter(t => incomingUpiIds.has(String(t.upi_id).trim().toLowerCase()))
              .map(t => t.id)
          : [];

        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) {
            throw new Error(`Error clearing old admin records: ${deleteError.message}`);
          }
        }

        // Insert new records
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactionsToInsert);

        if (insertError) {
          throw new Error(`Database upload failed for admin: ${insertError.message}`);
        }

        setAdminStatus({
          type: 'success',
          message: `Loaded ${transactionsToInsert.length} admin records. Running automatic reconciliation calculations for dates (${dateArray.join(', ')})...`
        });

        // Trigger strict verification
        await compareTransactionsForDates(dateArray);

        if (dateArray.length > 0) {
          setReportsFilterDate(dateArray[0]);
          setBacklogStartDate(dateArray[0]);
          setBacklogEndDate(dateArray[0]);
        }

        setAdminStatus({
          type: 'success',
          message: `Reconciliation evaluation complete! Imported ${transactionsToInsert.length} admin transactions and generated live reports across ${dateArray.length} date(s) (${dateArray.join(', ')}).`
        });

        // Refresh views
        fetchReports();
        fetchBacklogHistory();
        fetchCounters();

      } catch (err: any) {
        setAdminStatus({
          type: 'error',
          message: err.message || 'An unexpected error occurred during processing.'
        });
      } finally {
        setAdminUploading(false);
        if (adminFileInputRef.current) adminFileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setAdminStatus({ type: 'error', message: 'FileReader failed to load.' });
      setAdminUploading(false);
    };

    reader.readAsBinaryString(file);
  };



  // Wipe Admin Backlog
  const handleWipeAdminBacklog = async () => {
    if (window.confirm("⚠️ WARNING: This will permanently delete ALL uploaded Admin transaction data and clear all generated discrepancy reports. This action CANNOT be undone.\n\nAre you sure you want to proceed?")) {
      try {
        setBacklogLoading(true);
        const { error: reportsError } = await supabase.from('reports').delete().gt('id', 0);
        if (reportsError) throw new Error(`Failed to clear discrepancy reports: ${reportsError.message}`);
        const { error: txError } = await supabase.from('transactions').delete().eq('source', 'admin');
        if (txError) throw new Error(`Failed to clear admin transactions: ${txError.message}`);
        
        alert("🎉 Admin Backlog wiped successfully!");
        setSelectedDetailBatch(null);
        setSelectedReportCounterGroup(null);
        fetchBacklogHistory();
        fetchReports();
      } catch (err: any) {
        alert("Wipe error: " + err.message);
      } finally {
        setBacklogLoading(false);
      }
    }
  };

  // Wipe Counter Backlog
  const handleWipeCounterBacklog = async () => {
    if (window.confirm("⚠️ WARNING: This will permanently delete ALL uploaded Counter transaction data and clear all generated discrepancy reports. This action CANNOT be undone.\n\nAre you sure you want to proceed?")) {
      try {
        setBacklogLoading(true);
        const { error: reportsError } = await supabase.from('reports').delete().gt('id', 0);
        if (reportsError) throw new Error(`Failed to clear discrepancy reports: ${reportsError.message}`);
        const { error: txError } = await supabase.from('transactions').delete().eq('source', 'counter');
        if (txError) throw new Error(`Failed to clear counter transactions: ${txError.message}`);
        
        alert("🎉 Counter Backlog wiped successfully!");
        setSelectedBacklogCounter(null);
        setSelectedDetailBatch(null);
        setSelectedReportCounterGroup(null);
        fetchBacklogHistory();
        fetchReports();
      } catch (err: any) {
        alert("Wipe error: " + err.message);
      } finally {
        setBacklogLoading(false);
      }
    }
  };

  // Delete a specific batch of transactions for a particular day
  const handleDeleteBatch = async (date: string, source: 'counter' | 'admin', counter_id: number | null) => {
    if (!window.confirm(`⚠️ Are you sure you want to delete all ${source} transactions for ${date}? This will also clear discrepancy reports for this date.`)) return;
    try {
      setBacklogLoading(true);
      
      let txQuery = supabase.from('transactions').delete().eq('date', date).eq('source', source);
      if (source === 'counter' && counter_id) {
        txQuery = txQuery.eq('counter_id', counter_id);
      }
      
      const { error: txError } = await txQuery;
      if (txError) throw new Error(`Failed to delete transactions: ${txError.message}`);
      
      const { error: reportsError } = await supabase.from('reports').delete().eq('date', date);
      if (reportsError) throw new Error(`Failed to delete related reports: ${reportsError.message}`);
      
      alert(`🎉 Successfully deleted ${source} data for ${date}.`);
      
      // If the currently viewed batch details match, close the modal
      if (selectedDetailBatch?.date === date && selectedDetailBatch?.source === source && selectedDetailBatch?.counter_id === counter_id) {
        setSelectedDetailBatch(null);
      }
      
      fetchBacklogHistory();
      fetchReports();
    } catch (err: any) {
      alert("Delete error: " + err.message);
    } finally {
      setBacklogLoading(false);
    }
  };

  // Resolve single report discrepancy item
  const handleResolveReport = async (reportId: number) => {
    if (!window.confirm("Do you want to resolve this discrepancy?")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) {
        alert('Error resolving discrepancy: ' + error.message);
      } else {
        setSelectedReportCounterGroup((prev) => {
          if (!prev) return null;
          const updatedReports = prev.reports.filter(r => r.id !== reportId);
          if (updatedReports.length === 0) return null;
          const updatedTotal = updatedReports.reduce((sum, r) => sum + Number(r.amount), 0);
          return {
            ...prev,
            reports: updatedReports,
            totalAmount: updatedTotal
          };
        });
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMatchReport = async (reportId: number): Promise<boolean> => {
    try {
      const report = reportsData.find(r => r.id === reportId);
      if (!report || !report.date) return false;
      setReportsLoading(true);
      await compareTransactionsForDates([report.date]);
      
      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('date', report.date)
        .eq('upi_id', report.upi_id)
        .eq('amount', report.amount)
        .eq('type', report.type);

      // It's matched if the exact same discrepancy is no longer generated
      const isMatched = !error && (!data || data.length === 0);
      
      if (!isMatched && data && data.length > 0) {
        // The discrepancy still exists. Update the recreated report with is_failed_match: true.
        const recreatedReportId = data[0].id;
        const { data: fetchReq } = await supabase.from('reports').select('details').eq('id', recreatedReportId).single();
        if (fetchReq) {
          await supabase.from('reports').update({
            details: { ...fetchReq.details, is_failed_match: true }
          }).eq('id', recreatedReportId);
        }
      }

      await fetchReports();
      return isMatched;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setReportsLoading(false);
    }
  };

  const handleMatchAllReports = async (): Promise<{ allMatched: boolean, remainingCount: number }> => {
    try {
      if (!selectedReportCounterGroup || !selectedReportCounterGroup.reports) {
        return { allMatched: false, remainingCount: 0 };
      }
      setReportsLoading(true);
      
      const uniqueDates = Array.from(new Set(selectedReportCounterGroup.reports.map(r => r.date).filter(Boolean)));
      if (uniqueDates.length > 0) {
        await compareTransactionsForDates(uniqueDates as string[]);
      }
      
      // Query remaining for this counter and report type
      const reportType = currentSlide === 0 ? 'missing_in_admin' : currentSlide === 1 ? 'missing_in_counter' : 'duplicate_upi';
      let remainingQuery = supabase
        .from('reports')
        .select('id')
        .in('date', uniqueDates as string[])
        .eq('type', reportType);

      if (selectedReportCounterGroup.counterId !== null) {
        remainingQuery = remainingQuery.eq('counter_id', selectedReportCounterGroup.counterId);
      } else {
        remainingQuery = remainingQuery.is('counter_id', null);
      }

      const { data, error } = await remainingQuery;
      const remainingCount = (!error && data) ? data.length : selectedReportCounterGroup.reports.length;
      
      await fetchReports();
      return { allMatched: remainingCount === 0, remainingCount };
    } catch (err) {
      console.error(err);
      return { allMatched: false, remainingCount: selectedReportCounterGroup?.reports?.length || 0 };
    } finally {
      setReportsLoading(false);
    }
  };

  // Edit matching transaction details and update the discrepancy report (leaving resolution manual)
  const handleEditReport = async (reportId: number, newUpiId: string, newAmount: number) => {
    try {
      // 1. Get the original report to find the matching transaction details
      const { data: originalReport, error: getReportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (getReportError || !originalReport) {
        alert('Error retrieving report details: ' + (getReportError?.message || 'Report not found'));
        return;
      }

      // 2. Identify the transaction source
      let source = 'counter';
      if (originalReport.type === 'missing_in_counter') {
        source = 'admin';
      } else if (originalReport.type === 'duplicate_upi') {
        source = originalReport.details?.source || 'counter';
      }

      // 3. Find the transaction in the transactions table
      let findTxQuery = supabase
        .from('transactions')
        .select('id')
        .eq('upi_id', originalReport.upi_id)
        .eq('date', originalReport.date)
        .eq('source', source);

      if (source === 'counter' && originalReport.counter_id) {
        findTxQuery = findTxQuery.eq('counter_id', originalReport.counter_id);
      }

      const { data: txs, error: txError } = await findTxQuery;

      if (txError) {
        console.error('Error finding matching transaction:', txError.message);
      }

      // 4. Update the transaction in the transactions table if found
      if (txs && txs.length > 0) {
        const txIds = txs.map(t => t.id);
        const { error: updateTxError } = await supabase
          .from('transactions')
          .update({
            upi_id: newUpiId,
            amount: newAmount
          })
          .in('id', txIds);

        if (updateTxError) {
          alert('Error updating transaction details: ' + updateTxError.message);
          return;
        }
      } else {
        console.warn('Matching transaction not found in database to edit.');
      }

      // 5. Update report values inside the reports table so it correctly shows updated details
      const updatedDetails = {
        ...originalReport.details,
        is_edited: true,
        message: originalReport.type === 'missing_in_admin'
          ? `Cheque Number '${newUpiId}' is available in Counter but missing in Admin sheet.`
          : originalReport.type === 'missing_in_counter'
          ? `Transaction UTR '${newUpiId}' is available in Admin but missing from all Counter sheets.`
          : originalReport.details?.message
      };

      const { error: updateReportError } = await supabase
        .from('reports')
        .update({
          upi_id: newUpiId,
          amount: newAmount,
          details: updatedDetails
        })
        .eq('id', reportId);

      if (updateReportError) {
        alert('Error updating report details: ' + updateReportError.message);
      } else {
        // Update local modal state dynamically
        setSelectedReportCounterGroup((prev) => {
          if (!prev) return null;
          const updatedReports = prev.reports.map(r => {
            if (r.id === reportId) {
              return {
                ...r,
                upi_id: newUpiId,
                amount: newAmount,
                details: updatedDetails
              };
            }
            return r;
          });
          const updatedTotal = updatedReports.reduce((sum, r) => sum + Number(r.amount), 0);
          return {
            ...prev,
            reports: updatedReports,
            totalAmount: updatedTotal
          };
        });
        
        // Refresh all reports and dashboard stats
        fetchReports();
        fetchSystemMetrics();
      }
    } catch (err: any) {
      console.error('Error in edit:', err);
      alert('An unexpected error occurred: ' + err.message);
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setReportsData([]);
  };
  
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setReportsData([]);
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-6 md:p-10 font-sans relative overflow-hidden">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Top Navigation */}
        <div className="flex justify-between items-center bg-[#111111]/80 backdrop-blur-xl p-4 rounded-2xl border border-[#222222] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <Logo className="scale-90 origin-left" />

          {activeTab === 'home' ? (
            <button onClick={onLogout} className="flex items-center text-text-secondary hover:text-danger hover:bg-danger/10 transition-all text-sm font-semibold bg-[#222222] px-4 py-2.5 rounded-xl border border-transparent hover:border-danger/20">
              Logout
            </button>
          ) : (
            <button onClick={() => setActiveTab('home')} className="flex items-center text-text-secondary hover:text-white transition-all text-sm font-semibold bg-[#222222] px-4 py-2.5 rounded-xl border border-transparent hover:border-[#333333]">
              <ArrowLeft className="w-4 h-4 mr-2 text-purple-400 animate-pulse" />
              Back to Dashboard
            </button>
          )}
        </div>

        {activeTab === 'home' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
            {/* Elegant Welcome Banner & Stat Indicators */}
            <AdminHeader
              countersCount={counters.length}
              totalDiscrepancies={totalDiscrepancies}
              totalExcelEntries={totalExcelEntries}
            />

            {/* Control Modules Tiles */}
            <ControlModules onTabSelect={setActiveTab} />
          </div>
        )}

        {activeTab === 'manage' && (
          <AdminManageCounters
            counters={counters}
            loading={loading}
            onAddClick={() => setIsAddDialogOpen(true)}
            onEditClick={handleEdit}
            onDeleteClick={handleDelete}
          />
        )}

        {activeTab === 'upload' && (
           <Card className="bg-[#111111] border-[#222222] animate-in fade-in slide-in-from-bottom-4 rounded-2xl shadow-xl">
             <CardContent className="p-10 text-center space-y-6">
               
               {/* Admin Status Messages */}
               {adminStatus && (
                 <div 
                   className={`flex items-start justify-between p-4 rounded-2xl border text-left mb-6 ${
                     adminStatus.type === 'success' 
                       ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                       : 'bg-red-500/10 border-red-500/20 text-red-400'
                   } animate-in fade-in duration-300`}
                 >
                   <div className="flex items-center gap-3">
                     {adminStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                     <span className="text-sm font-medium leading-relaxed">{adminStatus.message}</span>
                   </div>
                   <button onClick={() => setAdminStatus(null)} className="text-text-secondary hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0">
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               )}

               <div 
                 onClick={!adminUploading ? triggerAdminFileSelect : undefined}
                 className={`w-16 h-16 bg-[#222222] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#333333] shadow-inner transition-all duration-300 ${
                   !adminUploading ? 'cursor-pointer hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]' : 'opacity-50'
                 }`}
               >
                 {adminUploading ? (
                   <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                 ) : (
                   <Upload className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
                 )}
               </div>
               <h3 className="text-xl font-bold text-white">
                 {adminUploading ? 'Parsing spreadsheet and evaluating reconciliation...' : 'Admin Upload & Compare'}
               </h3>
               <p className="text-sm text-text-secondary max-w-md mx-auto">
                 Upload the Admin Excel sheet. It must contain columns for <span className="text-purple-400 font-semibold">Transaction UTR</span>, <span className="text-purple-400 font-semibold">Transaction Date</span>, and <span className="text-purple-400 font-semibold">UPI Amount</span>.
               </p>
               
               <div className="flex justify-center items-center gap-4 pt-4">
                 <input 
                   type="file" 
                   ref={adminFileInputRef} 
                   onChange={handleAdminFileChange} 
                   accept=".xlsx, .xls" 
                   className="hidden" 
                 />
                 <Button 
                   onClick={triggerAdminFileSelect} 
                   disabled={adminUploading}
                   variant="secondary" 
                   className="rounded-xl h-11 border-[#222222] hover:bg-[#222222] disabled:opacity-50"
                 >
                   Select Admin Excel
                 </Button>
               </div>
             </CardContent>
           </Card>
        )}

        {activeTab === 'reports' && (
          <AdminReportsTab
            reportsData={reportsData}
            reportsLoading={reportsLoading}
            reportsFilterDate={reportsFilterDate}
            setReportsFilterDate={setReportsFilterDate}
            currentSlide={currentSlide}
            slides={slides}
            nextSlide={nextSlide}
            prevSlide={prevSlide}
            onOpenGroupDetails={setSelectedReportCounterGroup}
            groupedReportsByCounter={groupedReportsByCounter}
            onEditReport={handleEditReport}
            onMatchReport={handleMatchReport}
            onOpenDuplicateDetails={setSelectedDuplicateReport}
            overviewData={overviewData}
            overviewLoading={overviewLoading}
          />
        )}

        {activeTab === 'backlog' && (
          <AdminBacklogTab
            counterUploads={counterUploads}
            adminUploads={adminUploads}
            backlogStartDate={backlogStartDate}
            backlogEndDate={backlogEndDate}
            setBacklogStartDate={setBacklogStartDate}
            setBacklogEndDate={setBacklogEndDate}
            backlogLoading={backlogLoading}
            backlogSubTab={backlogSubTab}
            setBacklogSubTab={setBacklogSubTab}
            onWipeAdminBacklog={handleWipeAdminBacklog}
            onWipeCounterBacklog={handleWipeCounterBacklog}
            onDeleteBatch={handleDeleteBatch}
            onOpenBatchDetails={setSelectedDetailBatch}
            selectedBacklogCounter={selectedBacklogCounter}
            setSelectedBacklogCounter={setSelectedBacklogCounter}
            onRefreshLogs={fetchBacklogHistory}
          />
        )}

      </div>

      {/* Global Dialog Modals Container */}
      <AddCounterModal
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        newUsername={newUsername}
        setNewUsername={setNewUsername}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        onSubmit={handleAddCounterSubmit}
      />

      <ReportGroupDetailsModal
        group={selectedReportCounterGroup}
        onClose={() => setSelectedReportCounterGroup(null)}
        reportsFilterDate={reportsFilterDate}
        onResolveReport={handleResolveReport}
        onEditReport={handleEditReport}
        onMatchReport={handleMatchReport}
        onMatchAllReports={handleMatchAllReports}
      />

      <BatchDetailsModal
        batch={selectedDetailBatch}
        onClose={() => setSelectedDetailBatch(null)}
        batchDetailsLoading={batchDetailsLoading}
        batchDetailsData={batchDetailsData}
        batchDetailsSearch={batchDetailsSearch}
        setBatchDetailsSearch={setBatchDetailsSearch}
      />

      <DuplicateDetailsModal
        report={selectedDuplicateReport}
        onClose={() => setSelectedDuplicateReport(null)}
      />

    </div>
  );
}
