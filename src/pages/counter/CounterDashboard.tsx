import { useRef, useState, useEffect } from 'react';
import { FileBarChart2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';

import CounterHeader from './components/CounterHeader';
import CounterUploadCard from './components/CounterUploadCard';
import CounterDiscrepancyLog from './components/CounterDiscrepancyLog';
import CounterUploadHistory from './components/CounterUploadHistory';

// Fuzzy header synonym matching helper
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

// Robust Excel date parsing (handles JS Date objects, Excel numeric serials, and string formats)
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
  
  // Try DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // Try YYYY-MM-DD or YYYY/MM/DD
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

// Robust Excel amount parsing (cleans currency symbols, commas, and formatting)
const parseExcelAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^\d\.]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export default function CounterDashboard({ username, onLogout }: { username: string, onLogout: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const [uploads, setUploads] = useState<any[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);

  const fetchUploadHistory = async (userId: number) => {
    try {
      setUploadsLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('date, amount')
        .eq('source', 'counter')
        .eq('counter_id', userId);

      if (!error && data) {
        const grouped: { [key: string]: { date: string; count: number; totalAmount: number } } = {};
        data.forEach(item => {
          const d = item.date;
          if (!grouped[d]) {
            grouped[d] = { date: d, count: 0, totalAmount: 0 };
          }
          grouped[d].count += 1;
          grouped[d].totalAmount += Number(item.amount);
        });
        const arr = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
        setUploads(arr);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploadsLoading(false);
    }
  };

  const fetchCounterProfileAndReports = async () => {
    try {
      setReportsLoading(true);
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (userError || !user) {
        console.error('Profile fetch failed:', userError?.message);
        return;
      }

      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('counter_id', user.id)
        .order('date', { ascending: false });

      if (!reportsError && reportsData) {
        setReports(reportsData);
      }

      await fetchUploadHistory(user.id);
    } catch (e) {
      console.error(e);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchCounterProfileAndReports();
  }, [username]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // STRICT THREE-WAY RECONCILIATION ENGINE FOR IMMEDIATE BALANCING ON UPLOAD
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

        // STRICT REQUIREMENT: If admin has not uploaded transactions for this date yet,
        // do not run reconciliation or generate any discrepancy reports.
        if (adminTxs.length === 0) {
          continue;
        }

        const reportsToInsert: any[] = [];

        // Group counter transactions by trimmed lower UTR / Cheque No (last 10 characters for matching)
        const counterMap = new Map<string, any[]>();
        counterTxs.forEach(t => {
          let key = String(t.upi_id).trim().toLowerCase();
          if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
          const matchKey = key.slice(-10);
          if (!counterMap.has(matchKey)) counterMap.set(matchKey, []);
          counterMap.get(matchKey)!.push(t);
        });

        // Group admin transactions by trimmed lower UTR (last 10 characters for matching)
        const adminMap = new Map<string, any[]>();
        adminTxs.forEach(t => {
          let key = String(t.upi_id).trim().toLowerCase();
          if (key.endsWith('.0')) key = key.substring(0, key.length - 2);
          const matchKey = key.slice(-10);
          if (!adminMap.has(matchKey)) adminMap.set(matchKey, []);
          adminMap.get(matchKey)!.push(t);
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
        for (const [matchKey, cList] of counterMap.entries()) {
          const aList = adminMap.get(matchKey);
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
        for (const [matchKey, aList] of adminMap.entries()) {
          const cList = counterMap.get(matchKey);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStatus(null);
    setUploading(true);

    try {
      const transactionsToInsert: any[] = [];
      const uniqueDates = new Set<string>();

      // Query the database user first to get the correct counter ID
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (userError || !user) {
        throw new Error(`Profile query failed for user '${username}': ${userError?.message || 'User not found.'}`);
      }

      let phonepeId = '';

      // Helper function to read file as binary string asynchronously
      const readFileAsBinary = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (evt.target?.result) resolve(evt.target.result as string);
            else reject(new Error('Could not read file data.'));
          };
          reader.onerror = () => reject(new Error('FileReader failed to load file.'));
          reader.readAsBinaryString(file);
        });
      };

      // Loop through all selected files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const data = await readFileAsBinary(file);
        const workbook = XLSX.read(data, { type: 'binary' });

        // Loop through all sheets inside this workbook
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
          if (rows.length === 0) continue;

          // Fuzzy match required headers
          const chequeNoSynonyms = ['chequeno', 'chequename', 'chequeno.', 'chequeno', 'chequenumber', 'cheque_number', 'transactionutr', 'transactionid', 'upiid', 'utr', 'cheque'];
          const dateSynonyms = ['chequedate', 'cheque_date', 'date', 'transactiondate', 'transaction_date', 'uploaddate'];
          const receiptSynonyms = ['receipt', 'amount', 'receiptamount', 'receipt_amount', 'upiamount'];

          const firstRow = rows[0];
          const chequeKey = findHeaderKey(firstRow, chequeNoSynonyms);
          const dateKey = findHeaderKey(firstRow, dateSynonyms);
          const receiptKey = findHeaderKey(firstRow, receiptSynonyms);

          // Skip sheets that don't match counter template columns
          if (!chequeKey || !dateKey || !receiptKey) {
            console.warn(`Sheet "${sheetName}" in file "${file.name}" skipped: Missing required columns.`);
            continue;
          }

          // Extract PhonePe ID from column values (e.g. SKC SALES PHONE PE ID (83010307590))
          for (const row of rows) {
            for (const key of Object.keys(row)) {
              const val = String(row[key]).trim();
              if (val.toUpperCase().includes('PHONE PE ID') || val.toUpperCase().includes('PHONEPE ID') || val.toUpperCase().includes('SKC SALES')) {
                phonepeId = val;
                break;
              }
            }
            if (phonepeId) break;
          }

          rows.forEach((row, index) => {
            let upiId = String(row[chequeKey]).trim();
            if (upiId.endsWith('.0')) {
              upiId = upiId.substring(0, upiId.length - 2);
            }
            const rawDate = row[dateKey];
            const rawAmount = row[receiptKey];

            if (!upiId) return; // skip rows with empty cheque number/UTR

            const dateStr = parseExcelDate(rawDate);
            const amountNum = parseExcelAmount(rawAmount);

            if (!dateStr) {
              console.warn(`Row ${index + 2} in sheet "${sheetName}" skipped: Invalid date format.`);
              return;
            }

            transactionsToInsert.push({
              upi_id: upiId,
              date: dateStr,
              amount: amountNum,
              source: 'counter',
              counter_id: user.id
            });

            uniqueDates.add(dateStr);
          });
        }
      }

      if (transactionsToInsert.length === 0) {
        throw new Error('No valid transaction rows found in any of the selected files or sheets.');
      }

      if (phonepeId) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ counter_name: phonepeId })
          .eq('id', user.id);
        if (updateError) {
          console.error('Failed to update counter_name with phonepeId:', updateError.message);
        }
      }

      const dateArray = Array.from(uniqueDates);

      // 1. Fetch existing transaction records for these dates to identify duplicates cleanly by primary key
      const { data: existingTxs, error: fetchError } = await supabase
        .from('transactions')
        .select('id, upi_id')
        .eq('source', 'counter')
        .eq('counter_id', user.id)
        .in('date', dateArray);

      if (fetchError) {
        throw new Error(`Error checking for duplicate records: ${fetchError.message}`);
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
          throw new Error(`Error clearing old records: ${deleteError.message}`);
        }
      }

      // 2. Insert the fresh parsed transaction records
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);

      if (insertError) {
        throw new Error(`Database upload failed: ${insertError.message}`);
      }

      setStatus({
        type: 'success',
        message: `Imported ${transactionsToInsert.length} transactions across ${dateArray.length} date(s). Running automatic reconciliation...`
      });

      // 3. Trigger reconciliation engine calculations for the updated dates
      await compareTransactionsForDates(dateArray);

      setStatus({
        type: 'success',
        message: `All files and sheets processed successfully! Imported ${transactionsToInsert.length} transactions and completed reconciliation across ${dateArray.length} date(s) (${dateArray.join(', ')}).`
      });

      fetchCounterProfileAndReports();

    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || 'An unexpected error occurred during processing.'
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-6 md:p-10 font-sans relative overflow-hidden">
      
      {/* Decorative Background Glimmers */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Top Navigation */}
        <CounterHeader username={username} onLogout={onLogout} />

        {/* Status Alerts */}
        {status && (
          <div 
            className={`flex items-start justify-between p-4 rounded-2xl border ${
              status.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            } animate-in fade-in duration-300`}
          >
            <div className="flex items-center gap-3">
              {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span className="text-sm font-medium leading-relaxed">{status.message}</span>
            </div>
            <button onClick={() => setStatus(null)} className="text-text-secondary hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Counter Info Banner */}
        <Card className="bg-gradient-to-r from-[#111111] to-[#222222]/30 border-[#222222] overflow-hidden relative shadow-lg">
          <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Secure Session Established
              </span>
              <h1 className="text-2xl font-extrabold text-white">
                Daily Transaction Upload
              </h1>
              <p className="max-w-xl text-sm text-text-secondary">
                Upload your counter's transaction sheets daily. Our system will extract the date and verify against admin transaction records automatically.
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-[#09090b]/80 border border-[#222222] px-6 py-4 rounded-2xl">
              <div className="p-2.5 bg-purple-500/10 rounded-xl">
                <FileBarChart2 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <span className="block text-sm font-bold text-white">Verified Sheets</span>
                <span className="text-xs text-text-secondary">No errors found today</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Blocks Stacked Vertically */}
        <div className="flex flex-col gap-8">
          
          {/* Upload Section - Full Width */}
          <CounterUploadCard
            uploading={uploading}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            triggerFileSelect={triggerFileSelect}
          />

          {/* Discrepancies Section - Full Width Below */}
          <CounterDiscrepancyLog
            reports={reports}
            reportsLoading={reportsLoading}
          />

          {/* Upload History Section - Full Width Below */}
          <CounterUploadHistory
            uploads={uploads}
            uploadsLoading={uploadsLoading}
          />

        </div>

      </div>
    </div>
  );
}
