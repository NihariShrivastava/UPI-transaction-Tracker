import { useRef, useState, useEffect } from 'react';
import { Upload, FileBarChart2, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { supabase } from '../../lib/supabase';

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
        <div className="flex justify-between items-center bg-[#111111]/80 backdrop-blur-xl p-4 rounded-2xl border border-[#222222] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-4">
            <Logo className="scale-75 origin-left" />
            <div className="text-sm font-medium text-text-secondary border-l border-[#333333] pl-4 flex items-center gap-2">
              <span>Counter:</span>
              <span className="text-purple-400 font-bold text-lg">{username}</span>
            </div>
          </div>

          <button onClick={onLogout} className="flex items-center text-text-secondary hover:text-danger hover:bg-danger/10 transition-all text-sm font-semibold bg-[#222222] px-4 py-2.5 rounded-xl border border-transparent hover:border-danger/20">
            Logout
          </button>
        </div>

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
          
          {/* Upload Section - Full Width (Sleek Compact Height with Enhanced Readability) */}
          <Card className="bg-[#111111] border-[#222222] rounded-2xl shadow-xl flex flex-col justify-between">
            <CardHeader className="border-b border-[#222222] py-4 px-8 flex flex-row items-center justify-between bg-[#151515]">
              <CardTitle className="text-base font-bold text-white">Upload New Sheets</CardTitle>
              <span className="text-xs text-text-secondary hidden sm:inline">
                Required columns: <span className="text-purple-400 font-semibold">Cheque Number</span>, <span className="text-purple-400 font-semibold">Cheque Date</span>, <span className="text-purple-400 font-semibold">Receipt</span>
              </span>
            </CardHeader>
            <CardContent className="py-5 px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div 
                  onClick={!uploading ? triggerFileSelect : undefined}
                  className={`w-14 h-14 bg-[#222222] rounded-xl flex items-center justify-center border border-[#333333] shadow-inner group transition-all duration-300 ${
                    !uploading ? 'cursor-pointer hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.15)]' : 'opacity-50'
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7 text-purple-400 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <div className="text-left">
                  <h3 className="text-base font-bold text-white">
                    {uploading ? 'Parsing Excel spreadsheet...' : 'Select Daily Excel File'}
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Click the upload icon or button on the right to import your daily counter spreadsheet.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden" 
                />
                <Button 
                  onClick={triggerFileSelect} 
                  disabled={uploading}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 px-8 text-sm font-semibold shadow-[0_0_15px_rgba(139,92,246,0.2)] disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Choose Excel File'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Discrepancies Section - Full Width Below */}
          <Card className="bg-[#111111] border-[#222222] rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden">
            <CardHeader className="border-b border-[#222222] pb-4 flex flex-row justify-between items-center bg-[#151515]">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-purple-400" />
                Discrepancy Log
              </CardTitle>
              {reports.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-400 border border-red-500/20">
                  {reports.length} Alerts
                </span>
              )}
            </CardHeader>
            <CardContent className="p-6 flex flex-col justify-start overflow-hidden">
              {reportsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <span className="text-xs">Reconciling records...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
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
              ) : (
                <div className="space-y-4">
                  <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
                    The following discrepancies have been generated by the administrator. Please audit your entries:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900/30 scrollbar-track-transparent">
                    {reports.map((report) => (
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
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}>
                            {report.type === 'missing_in_admin' ? 'Missing UTR' : 'Duplicate'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[11px] font-semibold text-text-secondary">
                            Ref / Cheque: <span className="text-white font-mono">{report.upi_id}</span>
                          </span>
                          <span className="block text-[11px] font-semibold text-text-secondary">
                            Amount: <span className="text-purple-400 font-bold">₹{Number(report.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </span>
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

        </div>

      </div>
    </div>
  );
}
