import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, Users, UserPlus, Trash2, Upload, AlertTriangle, Archive, 
  ChevronLeft, ChevronRight, X, Sparkles, CheckCircle2, TrendingUp, 
  Loader2, RefreshCw, Calendar, Search 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/Table';
import Logo from '../../components/ui/Logo';
import { supabase } from '../../lib/supabase';

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
  const [newCounterName, setNewCounterName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Slider State
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ['Missing in Admin', 'Missing in Counter', 'Duplicate UPI IDs'];

  // Live Excel Upload State (Admin)
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const reportsDateInputRef = useRef<HTMLInputElement>(null);
  const backlogDateInputRef = useRef<HTMLInputElement>(null);
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminStatus, setAdminStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live Reports Slider state
  const [reportsFilterDate, setReportsFilterDate] = useState('');
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Live Backlog upload logs state
  const [backlogFilterDate, setBacklogFilterDate] = useState('');
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

  // Global Dashboard Statistics States
  const [totalDiscrepancies, setTotalDiscrepancies] = useState(0);
  const [totalExcelEntries, setTotalExcelEntries] = useState(0);

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
        setReportsFilterDate(data[0].date);
        setBacklogFilterDate(data[0].date);
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

  useEffect(() => {
    fetchCounters();
    fetchLatestDate();
    fetchSystemMetrics();
  }, []);

  // Fetch Reports dynamically depending on current slide and reports filter date
  const fetchReports = async () => {
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
        const { data: txs, error: txError } = await supabase
          .from('transactions')
          .select('*, users(counter_name)')
          .eq('date', date);

        if (txError || !txs) {
          console.error(`Error fetching transactions for comparison on ${date}:`, txError?.message);
          continue;
        }

        const counterTxs = txs.filter(t => t.source === 'counter');
        const adminTxs = txs.filter(t => t.source === 'admin');

        // Clear pre-existing reports to prevent drift/overlap
        await supabase
          .from('reports')
          .delete()
          .eq('date', date);

        const reportsToInsert: any[] = [];

        // Group counter transactions by trimmed lower UTR / Cheque No
        const counterMap = new Map<string, any[]>();
        counterTxs.forEach(t => {
          let key = String(t.upi_id).trim().toLowerCase();
          if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
          if (!counterMap.has(key)) counterMap.set(key, []);
          counterMap.get(key)!.push(t);
        });

        // Group admin transactions by trimmed lower UTR
        const adminMap = new Map<string, any[]>();
        adminTxs.forEach(t => {
          let key = String(t.upi_id).trim().toLowerCase();
          if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
          if (!adminMap.has(key)) adminMap.set(key, []);
          adminMap.get(key)!.push(t);
        });

        // Check duplicate Cheque Numbers in Counter sheets
        for (const [, list] of counterMap.entries()) {
          if (list.length > 1) {
            reportsToInsert.push({
              date,
              type: 'duplicate_upi',
              upi_id: list[0].upi_id,
              amount: list[0].amount,
              counter_id: list[0].counter_id,
              details: {
                source: 'counter',
                count: list.length,
                message: `Duplicate Cheque Number '${list[0].upi_id}' loaded in Counter '${list[0].users?.counter_name || 'Unknown'}' (${list.length} records)`
              }
            });
          }
        }

        // Check duplicate Transaction UTRs in Admin sheets
        for (const [, list] of adminMap.entries()) {
          if (list.length > 1) {
            reportsToInsert.push({
              date,
              type: 'duplicate_upi',
              upi_id: list[0].upi_id,
              amount: list[0].amount,
              counter_id: null,
              details: {
                source: 'admin',
                count: list.length,
                message: `Duplicate Transaction UTR '${list[0].upi_id}' loaded in Admin sheet (${list.length} records)`
              }
            });
          }
        }

        // strict validation: missing in admin or amount discrepancies
        for (const [upiId, cList] of counterMap.entries()) {
          const aList = adminMap.get(upiId);
          if (!aList) {
            // Missing in Admin completely
            cList.forEach(c => {
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
            });
          } else {
            // Check strict match for amount
            cList.forEach(c => {
              const matchingAdmin = aList.find(a => Number(a.amount) === Number(c.amount));
              if (!matchingAdmin) {
                // strict match failed on amount
                reportsToInsert.push({
                  date,
                  type: 'missing_in_admin',
                  upi_id: c.upi_id,
                  amount: c.amount,
                  counter_id: c.counter_id,
                  details: {
                    counter_name: c.users?.counter_name || 'Unknown',
                    cheque_amount: c.amount,
                    admin_amounts: aList.map(a => a.amount),
                    message: `Cheque Number '${c.upi_id}' matched keys, but amount verification failed! Counter receipt: ${c.amount}, Admin UPI Amount: ${aList.map(a => a.amount).join(', ')}`
                  }
                });
              }
            });
          }
        }

        // strict validation: missing in counter
        for (const [upiId, aList] of adminMap.entries()) {
          const cList = counterMap.get(upiId);
          if (!cList) {
            aList.forEach(a => {
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
            });
          }
        }

        if (reportsToInsert.length > 0) {
          await supabase.from('reports').insert(reportsToInsert);
        }

      } catch (err) {
        console.error(`Comparison error for date ${date}:`, err);
      }
    }
  };

  const handleAddCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCounterName && newUsername && newPassword) {
      try {
        const { error } = await supabase
          .from('users')
          .insert([
            {
              role: 'counter',
              username: newUsername,
              password: newPassword,
              counter_name: newCounterName,
              logins: 0,
            }
          ]);

        if (error) {
          alert('Error creating counter: ' + error.message);
        } else {
          setIsAddDialogOpen(false);
          setNewCounterName('');
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

  const handleEdit = async (id: number, currentName: string) => {
    const newName = prompt("Edit name for " + currentName, currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ counter_name: newName })
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
        const utrSynonyms = ['transactionutr', 'utr', 'transactionid', 'upiid', 'chequeno', 'chequenumber', 'cheque_number', 'referenceno', 'refno'];
        const dateSynonyms = ['transactiondate', 'transaction_date', 'date', 'chequedate', 'cheque_date', 'uploaddate'];
        const amountSynonyms = ['upiamount', 'amount', 'receipt', 'receiptamount', 'receipt_amount', 'value'];

        const firstRow = rows[0];
        const utrKey = findHeaderKey(firstRow, utrSynonyms);
        const dateKey = findHeaderKey(firstRow, dateSynonyms);
        const amountKey = findHeaderKey(firstRow, amountSynonyms);

        if (!utrKey || !dateKey || !amountKey) {
          throw new Error(
            `Header verification failed. Your Admin Excel must contain columns resembling "Transaction UTR" (found: ${utrKey ? 'Yes' : 'No'}), "Transaction Date" (found: ${dateKey ? 'Yes' : 'No'}), and "UPI Amount" (found: ${amountKey ? 'Yes' : 'No'}).`
          );
        }

        const transactionsToInsert: any[] = [];
        const uniqueDates = new Set<string>();

        rows.forEach((row) => {
          let upiId = String(row[utrKey]).trim();
          if (upiId.endsWith('.0')) {
            upiId = upiId.substring(0, upiId.length - 2);
          }
          const rawDate = row[dateKey];
          const rawAmount = row[amountKey];

          if (!upiId) return;

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

        // Delete old admin transaction uploads for these dates to avoid duplicates
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('source', 'admin')
          .in('date', dateArray);

        if (deleteError) {
          throw new Error(`Error clearing old admin records: ${deleteError.message}`);
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
          setBacklogFilterDate(dateArray[0]);
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



  // Master backlog wipe action
  const handleWipeAllBacklogData = async () => {
    if (window.confirm("⚠️ WARNING: This will permanently delete ALL uploaded transaction data (from both Admin and all Counters) and clear all generated discrepancy reports in the entire system. This action CANNOT be undone.\n\nAre you absolutely sure you want to perform this master database wipe?")) {
      try {
        setBacklogLoading(true);
        
        // Delete all reports
        const { error: reportsError } = await supabase
          .from('reports')
          .delete()
          .gt('id', 0);
          
        if (reportsError) {
          throw new Error(`Failed to clear discrepancy reports: ${reportsError.message}`);
        }

        // Delete all transactions
        const { error: txError } = await supabase
          .from('transactions')
          .delete()
          .gt('id', 0);

        if (txError) {
          throw new Error(`Failed to clear transactions database: ${txError.message}`);
        }

        alert("🎉 Master wipe completed successfully! Entire transaction backlog and all reports have been fully cleared.");
        
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

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setReportsData([]);
  };
  
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setReportsData([]);
  };

  // Filtering lists for the backlog tab
  const filteredCounterUploads = useMemo(() => {
    if (!backlogFilterDate) return counterUploads;
    return counterUploads.filter(c => c.uploads.some((u: any) => u.date === backlogFilterDate));
  }, [counterUploads, backlogFilterDate]);

  const filteredAdminUploads = useMemo(() => {
    if (!backlogFilterDate) return adminUploads;
    return adminUploads.filter(u => u.date === backlogFilterDate);
  }, [adminUploads, backlogFilterDate]);

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-6 md:p-10 font-sans relative overflow-hidden">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-[150px] pointer-events-none" />

      {/* Add Counter Dialog */}
      {isAddDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md"
          >
            <Card className="bg-[#111111] border-[#222222] shadow-[0_0_50px_rgba(139,92,246,0.15)] rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[#222222]">
                <CardTitle className="text-xl text-purple-400 font-bold">Add New Counter</CardTitle>
                <button onClick={() => setIsAddDialogOpen(false)} className="text-text-secondary hover:text-white p-1 rounded-lg hover:bg-[#222222] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAddCounterSubmit} className="space-y-4">
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
                    <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" variant="primary" className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)]">Create Counter</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

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
                      <span className="block text-2xl font-bold text-white">{counters.length}</span>
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
                    <h3 className="text-3xl font-bold text-white mt-1">{counters.length}</h3>
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

            {/* Grid of Dynamic Actions */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 pl-1">
                <TrendingUp className="w-5 h-5 text-purple-400" /> Control Modules
              </h2>
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, staggerChildren: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {/* Manage Counters Card */}
                <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => setActiveTab('manage')}>
                  <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                      <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                        <Users className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Manage Counters</h3>
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">Add, edit, or remove client counters and monitor account access.</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Upload & Compare Card */}
                <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => setActiveTab('upload')}>
                  <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                      <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                        <Upload className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Upload & Compare</h3>
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">Upload Admin excels and trigger automated three-way comparisons.</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Reports Slider Card */}
                <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => setActiveTab('reports')}>
                  <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                      <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                        <AlertTriangle className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Reports Slider</h3>
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">Examine and update transaction reports through interactive slides.</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Backlog Card */}
                <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => setActiveTab('backlog')}>
                  <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                      <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                        <Archive className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Backlog Reports</h3>
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">Search through previous day records and wipe historical entries safely.</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-6 transform transition-all animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <Card className="w-full max-w-sm bg-[#111111] border-[#222222] shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4 py-4">
                  <div className="p-2 bg-[#222222] rounded-lg">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Manage Counters</CardTitle>
                    <p className="text-sm text-text-secondary mt-1">
                      {counters.length} total counter accounts in the system.
                    </p>
                  </div>
                </CardHeader>
              </Card>

              <Button className="shrink-0 font-semibold shadow-md bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-11" onClick={() => setIsAddDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add New Counter
              </Button>
            </div>

            <div className="bg-[#111111] rounded-2xl border border-[#222222] shadow-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-[#222222]">
                    <TableHead className="w-[200px]">Counter Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="text-center">Logins</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-text-secondary">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                          <span>Loading counters from database...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : counters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-text-secondary">
                        No counters found in system. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    counters.map((counter) => (
                      <TableRow key={counter.id} className="group border-b border-[#222222]/50 hover:bg-[#222222]/20 transition-colors">
                        <TableCell className="font-semibold text-white">{counter.name}</TableCell>
                        <TableCell className="text-text-secondary font-mono">{counter.username}</TableCell>
                        <TableCell className="text-text-secondary font-mono tracking-wider">{counter.password}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#222222] text-sm font-semibold text-purple-400 border border-[#333333]">
                            {counter.logins}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" className="font-semibold text-text-secondary hover:text-white" onClick={() => handleEdit(counter.id, counter.name)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-danger hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(counter.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
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
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
             {/* Slider Navigation Header (Based on provided image) */}
             <div className="bg-[#111111] border-y border-[#222222] flex items-center justify-between p-4 rounded-2xl shadow-lg">
                <Button variant="secondary" size="sm" onClick={prevSlide} className="w-10 h-10 p-0 rounded-xl bg-[#222222] border-[#333333] hover:bg-[#333333]">
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

                <Button variant="secondary" size="sm" onClick={nextSlide} className="w-10 h-10 p-0 rounded-xl bg-[#222222] border-[#333333] hover:bg-[#333333]">
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
                  <div 
                    onClick={() => {
                      try {
                        reportsDateInputRef.current?.showPicker();
                      } catch (e) {
                        reportsDateInputRef.current?.focus();
                      }
                    }}
                    className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 cursor-pointer hover:border-purple-500/50 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <input 
                      type="date" 
                      ref={reportsDateInputRef}
                      value={reportsFilterDate}
                      onChange={e => setReportsFilterDate(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent text-xs text-white focus:outline-none cursor-pointer" 
                    />
                    {reportsFilterDate && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportsFilterDate('');
                        }} 
                        className="text-text-secondary hover:text-white ml-1 font-bold"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {reportsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <span>Loading live reports from Supabase...</span>
                  </div>
                ) : reportsData.length === 0 ? (
                  <div className="text-center py-16 text-emerald-400 font-semibold bg-emerald-500/5 rounded-2xl border border-emerald-500/10 shadow-lg">
                    {reportsFilterDate 
                      ? "Perfect match! No discrepancies found on this date."
                      : "Awesome! No live discrepancy reports found in the database."}
                  </div>
                ) : (
                  <div>
                    {/* Render different layouts depending on currentSlide */}
                    {currentSlide === 0 ? (
                      /* Slide 0: Missing in Admin (Grouped by Counter Cards) */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                        {groupedReportsByCounter.map((group, idx) => (
                          <motion.div
                            key={`${group.counterId || 'unknown'}_${idx}`}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -6, scale: 1.02 }}
                            onClick={() => setSelectedReportCounterGroup(group)}
                            className="group relative bg-gradient-to-br from-[#161616] to-[#0d0d0d] border border-[#222222] hover:border-purple-500/40 p-6 rounded-2xl transition-all duration-300 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between"
                          >
                            {/* Hover light effect */}
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
                    ) : (
                      /* Slide 1 & Slide 2: Render premium individual cards */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                        {reportsData.map((report) => (
                          <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -4 }}
                            className="group relative bg-gradient-to-br from-[#161616] to-[#0d0d0d] border border-[#222222] hover:border-purple-500/30 p-6 rounded-2xl transition-all duration-300 shadow-xl overflow-hidden flex flex-col justify-between"
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
                            </div>

                            <div className="mt-6 pt-4 border-t border-[#222222]/80 flex items-center justify-between">
                              <span className="text-sm font-mono text-purple-400 font-bold">
                                ₹{Number(report.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResolveReport(report.id)}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 font-semibold rounded-lg text-xs h-8"
                              >
                                Resolve
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
             </div>
           </div>
        )}

        {activeTab === 'backlog' && (
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
                       setSelectedBacklogCounter(null);
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
                       setSelectedBacklogCounter(null);
                     }}
                     className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                       backlogSubTab === 'admin' ? 'bg-purple-600 text-white shadow-md' : 'text-text-secondary hover:text-white'
                     }`}
                   >
                     According to Admin
                   </button>
                 </div>

                 {/* Date Filter input */}
                  <div 
                    onClick={() => {
                      try {
                        backlogDateInputRef.current?.showPicker();
                      } catch (e) {
                        backlogDateInputRef.current?.focus();
                      }
                    }}
                    className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 cursor-pointer hover:border-purple-500/50 transition-colors"
                  >
                   <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                   <input 
                     type="date" 
                     ref={backlogDateInputRef}
                     value={backlogFilterDate}
                     onChange={e => setBacklogFilterDate(e.target.value)}
                     onClick={e => e.stopPropagation()}
                     className="bg-transparent text-xs text-white focus:outline-none cursor-pointer" 
                   />
                   {backlogFilterDate && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setBacklogFilterDate('');
                        }} 
                        className="text-text-secondary hover:text-white ml-1"
                      >
                       <X className="w-3 h-3" />
                     </button>
                   )}
                 </div>

                 {/* Refresh logs button */}
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={fetchBacklogHistory} 
                   className="w-9 h-9 p-0 rounded-xl bg-[#222222] border border-[#333333] hover:bg-[#333333]"
                   title="Refresh Backlog Logs"
                 >
                   <RefreshCw className="w-4 h-4 text-purple-400" />
                 </Button>

                 {/* Giant Database Backlog Wipe Button */}
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={handleWipeAllBacklogData} 
                   className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-red-400 hover:text-white transition-all font-bold text-xs h-9 shadow-md"
                   title="Permanently wipe entire transaction database and discrepancy reports backlog"
                 >
                   <Trash2 className="w-4 h-4" />
                   Wipe Database Backlog
                 </Button>
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
                       {/* Grid of Counter Boxes */}
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                         {filteredCounterUploads.map((log) => {
                           const isSelected = selectedBacklogCounter?.counterId === log.counterId;
                           return (
                             <motion.div
                               key={log.counterId}
                               whileHover={{ y: -4, scale: 1.02 }}
                               onClick={() => setSelectedBacklogCounter(log)}
                               className={`group relative p-6 rounded-2xl border transition-all duration-300 shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between ${
                                 isSelected 
                                   ? 'bg-gradient-to-br from-purple-900/30 to-[#111111] border-purple-500/60 shadow-[0_0_20px_rgba(139,92,246,0.15)]' 
                                   : 'bg-gradient-to-br from-[#161616] to-[#0d0d0d] border-[#222222] hover:border-purple-500/30'
                               }`}
                             >
                               <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                               <div className="flex items-center gap-4">
                                 <div className={`p-3 rounded-xl transition-colors ${
                                   isSelected ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-400'
                                 }`}>
                                   <Users className="w-5 h-5" />
                                 </div>
                                 <div className="flex-grow min-w-0">
                                   <h4 className="text-sm font-bold text-white tracking-wide group-hover:text-purple-300 transition-colors truncate" title={log.counterName}>
                                     {log.counterName}
                                   </h4>
                                   <p className="text-[11px] text-text-secondary mt-0.5 font-semibold">
                                     {log.uploads.length} distinct upload dates
                                   </p>
                                 </div>
                               </div>

                               <div className="mt-6 pt-4 border-t border-[#222222]/80 flex justify-between items-center text-xs">
                                 <span className="text-text-secondary">Total Transactions:</span>
                                 <span className="font-mono text-purple-400 font-bold">{log.totalCount} rows</span>
                                </div>
                             </motion.div>
                           );
                         })}
                       </div>

                       {/* Detailed upload date history list for clicked counter */}
                       <AnimatePresence>
                         {selectedBacklogCounter && (
                           <motion.div 
                             initial={{ opacity: 0, y: 20 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: 20 }}
                             className="mt-10 p-6 bg-[#161616] border border-purple-500/20 rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in duration-300"
                           >
                             <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#222222] pb-5 mb-6 gap-4 relative z-10">
                               <div>
                                 <span className="text-[9px] tracking-widest text-purple-400 font-extrabold uppercase bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20">
                                   Detailed Upload History
                                 </span>
                                 <h4 className="text-xl font-extrabold text-white mt-2 flex items-center gap-2">
                                   <Users className="w-5 h-5 text-purple-400" />
                                   {selectedBacklogCounter.counterName}
                                 </h4>
                               </div>
                               <button 
                                 onClick={() => setSelectedBacklogCounter(null)}
                                 className="text-xs text-text-secondary hover:text-white px-3 py-1.5 rounded-xl bg-[#222222] hover:bg-[#333333] transition-colors border border-[#333333]"
                               >
                                 Close Detailed View
                               </button>
                             </div>

                             <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#111111] relative z-10">
                               <Table>
                                 <TableHeader>
                                   <TableRow className="hover:bg-transparent border-b border-[#222222] bg-[#1a1a1a]">
                                     <TableHead>Upload Date</TableHead>
                                     <TableHead className="text-center">Transaction Records Count</TableHead>
                                     <TableHead>Execution Status</TableHead>
                                     <TableHead className="text-right">Actions</TableHead>
                                   </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                   {selectedBacklogCounter.uploads.map((upload: any, idx: number) => (
                                     <TableRow key={`${upload.date}_${idx}`} className="hover:bg-[#222222]/20 border-b border-[#222222]/50 transition-colors">
                                       <TableCell className="font-mono text-white font-semibold">
                                         {upload.date}
                                       </TableCell>
                                       <TableCell className="text-center font-mono text-purple-400 font-bold">
                                         {upload.count} rows
                                       </TableCell>
                                       <TableCell>
                                         <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                           Completed
                                         </span>
                                       </TableCell>
                                       <TableCell className="text-right">
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           onClick={() => setSelectedDetailBatch({
                                             counter_id: selectedBacklogCounter.counterId,
                                             counter_name: selectedBacklogCounter.counterName,
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
                           </motion.div>
                         )}
                       </AnimatePresence>
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
                                  onClick={() => setSelectedDetailBatch({
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedDetailBatch({
                                    counter_id: null,
                                    counter_name: 'Main Admin Sheet',
                                    date: log.date,
                                    source: 'admin'
                                  })}
                                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-4 font-bold rounded-xl text-xs h-8 transition-all"
                                >
                                  View Transactions
                                </Button>
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
        )}

        {/* Batch Details Modal */}
        <AnimatePresence>
          {selectedDetailBatch && (
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
                      Batch: <span className="text-purple-400 font-bold">{selectedDetailBatch.counter_name}</span> | Date: <span className="text-purple-400 font-bold">{selectedDetailBatch.date}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedDetailBatch(null)} 
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
                    onClick={() => setSelectedDetailBatch(null)} 
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg font-semibold h-10 px-6"
                  >
                    Close Batch
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Report Counter Group Details Modal */}
        <AnimatePresence>
          {selectedReportCounterGroup && (
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
                      Counter: <span className="text-purple-400 font-bold">{selectedReportCounterGroup.counterName}</span> | Date: <span className="text-purple-400 font-bold">{reportsFilterDate}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedReportCounterGroup(null)} 
                    className="text-text-secondary hover:text-white p-2 rounded-xl hover:bg-[#222222] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info Bar */}
                <div className="px-6 py-4 bg-[#111111] border-b border-[#222222]/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="text-xs text-text-secondary">
                    Total Discrepancies: <span className="text-white font-bold">{selectedReportCounterGroup.reports.length} items</span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Mismatched Value Sum: <span className="text-purple-400 font-bold">₹{selectedReportCounterGroup.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
                        {selectedReportCounterGroup.reports.map((report, idx) => (
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
                                onClick={() => handleResolveReport(report.id)}
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
                    onClick={() => setSelectedReportCounterGroup(null)} 
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg font-semibold h-10 px-6"
                  >
                    Close Audit
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
