import { Users, UserPlus, Loader2, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/Table';

interface AdminManageAuditorsProps {
  auditors: any[];
  loading: boolean;
  onAddClick: () => void;
  onEditClick: (id: number, currentUsername: string) => void;
  onDeleteClick: (id: number) => void;
}

export default function AdminManageAuditors({
  auditors,
  loading,
  onAddClick,
  onEditClick,
  onDeleteClick
}: AdminManageAuditorsProps) {
  return (
    <div className="space-y-6 transform transition-all animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Card className="w-full max-w-sm bg-[#111111] border-[#222222] shadow-lg">
          <CardHeader className="flex flex-row items-center gap-4 py-4">
            <div className="p-2 bg-[#222222] rounded-lg">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Manage Auditors</CardTitle>
              <p className="text-sm text-text-secondary mt-1">
                {auditors.length} total auditors in the system.
              </p>
            </div>
          </CardHeader>
        </Card>

        <Button 
          className="shrink-0 font-semibold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11" 
          onClick={onAddClick}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add New Auditor
        </Button>
      </div>

      <div className="bg-[#111111] rounded-2xl border border-[#222222] shadow-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-[#222222]">
              <TableHead className="w-[250px]">Username</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Assigned Team Lead</TableHead>
              <TableHead className="text-center">Logins</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-text-secondary">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Loading auditors from database...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : auditors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-text-secondary">
                  No auditors found in system. Create one to get started!
                </TableCell>
              </TableRow>
            ) : (
              auditors.map((auditor) => (
                <TableRow key={auditor.id} className="group border-b border-[#222222]/50 hover:bg-[#222222]/20 transition-colors">
                  <TableCell className="font-semibold text-white">{auditor.username}</TableCell>
                  <TableCell className="text-text-secondary font-mono tracking-wider">{auditor.password}</TableCell>
                  <TableCell className="text-text-secondary font-semibold">
                    {auditor.assigned_team_leads && auditor.assigned_team_leads.length > 0 
                      ? auditor.assigned_team_leads.join(', ') 
                      : 'None'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#222222] text-sm font-semibold text-emerald-400 border border-[#333333]">
                      {auditor.logins}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="font-semibold text-text-secondary hover:text-white" 
                      onClick={() => onEditClick(auditor.id, auditor.username)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-danger hover:text-red-400 hover:bg-red-500/10" 
                      onClick={() => onDeleteClick(auditor.id)}
                    >
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
  );
}
