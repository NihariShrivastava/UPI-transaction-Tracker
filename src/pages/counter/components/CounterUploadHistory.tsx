import { useState, useRef } from 'react';
import { History, Loader2, Calendar, X, FileSpreadsheet } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/Table';

interface UploadHistoryItem {
  date: string;
  count: number;
  totalAmount: number;
}

interface CounterUploadHistoryProps {
  uploads: UploadHistoryItem[];
  uploadsLoading: boolean;
}

export default function CounterUploadHistory({
  uploads,
  uploadsLoading
}: CounterUploadHistoryProps) {
  const [tempFilterDate, setTempFilterDate] = useState('');
  const [appliedFilterDate, setAppliedFilterDate] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Apply local date filtering
  const filteredUploads = appliedFilterDate
    ? uploads.filter(u => u.date === appliedFilterDate)
    : uploads;

  const handleApply = () => {
    setAppliedFilterDate(tempFilterDate);
  };

  const handleClear = () => {
    setTempFilterDate('');
    setAppliedFilterDate('');
  };

  return (
    <Card className="bg-[#111111] border-[#222222] rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden">
      <CardHeader className="border-b border-[#222222] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#151515]">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          <CardTitle className="text-lg font-bold text-white">
            Upload History
          </CardTitle>
          {filteredUploads.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {filteredUploads.length} Batches
            </span>
          )}
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div 
            onClick={() => {
              try {
                dateInputRef.current?.showPicker();
              } catch (e) {
                dateInputRef.current?.focus();
              }
            }}
            className="flex items-center gap-2 bg-[#000000] border border-[#222222] rounded-xl px-3 py-1.5 cursor-pointer hover:border-purple-500/50 transition-colors w-full sm:w-auto"
          >
            <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <input 
              type="date" 
              ref={dateInputRef}
              value={tempFilterDate}
              onChange={e => setTempFilterDate(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full" 
            />
            {tempFilterDate && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }} 
                className="text-text-secondary hover:text-white ml-1 font-bold"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <Button
            onClick={handleApply}
            disabled={!tempFilterDate}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-[#222222] disabled:text-text-secondary text-white font-bold text-xs px-4 h-[34px] rounded-xl transition-all"
          >
            Apply
          </Button>

          {appliedFilterDate && (
            <Button
              onClick={handleClear}
              variant="ghost"
              className="text-text-secondary hover:text-white font-bold text-xs px-3 h-[34px] rounded-xl"
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 flex flex-col justify-start overflow-hidden">
        {uploadsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary gap-3 w-full">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="text-xs">Loading historic spreadsheet data...</span>
          </div>
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-12 w-full">
            <div className="p-4 bg-purple-500/10 rounded-2xl text-purple-400">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-white text-base">No Upload History Yet</h4>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[320px]">
              Use the upload area above to submit your counter's transaction sheets. Once uploaded, your history will show up here.
            </p>
          </div>
        ) : filteredUploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 w-full">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-sm">No Uploads on This Date</h4>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[300px] mt-1">
              You haven't submitted any spreadsheet batches on <span className="text-purple-400 font-mono">{appliedFilterDate}</span>.
            </p>
            <Button onClick={handleClear} variant="ghost" className="text-purple-400 hover:text-purple-300 font-bold text-xs mt-4">
              Show All History
            </Button>
          </div>
        ) : (
          <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#0d0d0d] shadow-lg">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-[#222222] bg-[#161616]">
                  <TableHead className="font-semibold text-text-secondary text-xs">Upload Date</TableHead>
                  <TableHead className="text-center font-semibold text-text-secondary text-xs">Record Count</TableHead>
                  <TableHead className="text-center font-semibold text-text-secondary text-xs">Total Value Sum</TableHead>
                  <TableHead className="text-right font-semibold text-text-secondary text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUploads.map((item, idx) => (
                  <TableRow key={`${item.date}_${idx}`} className="hover:bg-[#222222]/10 border-b border-[#222222]/50 transition-colors">
                    <TableCell className="font-mono text-white font-bold py-4">
                      {item.date}
                    </TableCell>
                    <TableCell className="text-center font-mono text-purple-400 font-bold">
                      {item.count} rows
                    </TableCell>
                    <TableCell className="text-center font-mono text-emerald-400 font-extrabold">
                      ₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Synchronized
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
