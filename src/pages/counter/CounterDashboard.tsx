import { useRef, useState, useEffect } from 'react';
import { FileBarChart2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';

import CounterHeader from './components/CounterHeader';
import CounterUploadCard from './components/CounterUploadCard';
import CounterDiscrepancyLog from './components/CounterDiscrepancyLog';

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data.');

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Parse rows as objects
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
        if (rows.length === 0) {
          throw new Error('The selected Excel sheet is empty.');
        }

        // Fuzzy match required headers
        const chequeNoSynonyms = ['chequeno', 'chequename', 'chequeno.', 'chequeno', 'chequenumber', 'cheque_number', 'transactionutr', 'transactionid', 'upiid', 'utr', 'cheque'];
        const dateSynonyms = ['chequedate', 'cheque_date', 'date', 'transactiondate', 'transaction_date', 'uploaddate'];
        const receiptSynonyms = ['receipt', 'amount', 'receiptamount', 'receipt_amount', 'upiamount', 'upiamount'];

        const firstRow = rows[0];
        const chequeKey = findHeaderKey(firstRow, chequeNoSynonyms);
        const dateKey = findHeaderKey(firstRow, dateSynonyms);
        const receiptKey = findHeaderKey(firstRow, receiptSynonyms);

        if (!chequeKey || !dateKey || !receiptKey) {
          throw new Error(
            `Header verification failed. Your Excel must contain columns resembling "Cheque Number" (found: ${chequeKey ? 'Yes' : 'No'}), "Cheque Date" (found: ${dateKey ? 'Yes' : 'No'}), and "Receipt" (found: ${receiptKey ? 'Yes' : 'No'}).`
          );
        }

        // Map and validate rows
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
            console.warn(`Row ${index + 2} skipped: Invalid date format.`);
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

        if (transactionsToInsert.length === 0) {
          throw new Error('No valid transaction rows found in the spreadsheet.');
        }

        const dateArray = Array.from(uniqueDates);

        // 1. Delete previous uploads from this counter on the matched dates to avoid duplicates
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('source', 'counter')
          .eq('counter_id', user.id)
          .in('date', dateArray);

        if (deleteError) {
          throw new Error(`Error clearing old records: ${deleteError.message}`);
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
          message: `Sheet processed successfully! Imported ${transactionsToInsert.length} transactions spanning ${dateArray.length} date(s) (${dateArray.join(', ')}).`
        });

        fetchCounterProfileAndReports();

      } catch (err: any) {
        setStatus({
          type: 'error',
          message: err.message || 'An unexpected error occurred during processing.'
        });
      } finally {
        setUploading(false);
        // Reset file input value so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setStatus({ type: 'error', message: 'FileReader failed to load the file.' });
      setUploading(false);
    };

    reader.readAsBinaryString(file);
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

        </div>

      </div>
    </div>
  );
}
