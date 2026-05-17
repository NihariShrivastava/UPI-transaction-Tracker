import { Upload, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface CounterUploadCardProps {
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  triggerFileSelect: () => void;
}

export default function CounterUploadCard({
  uploading,
  fileInputRef,
  onFileChange,
  triggerFileSelect
}: CounterUploadCardProps) {
  return (
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
            onChange={onFileChange}
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
  );
}
