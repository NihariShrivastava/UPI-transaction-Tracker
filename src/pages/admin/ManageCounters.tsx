import { useState, useEffect } from 'react';
import { ArrowLeft, Users, UserPlus, Trash2, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/Table';
import { supabase } from '../../lib/supabase';

export default function ManageCounters() {
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Counter Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCounterName, setNewCounterName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

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

  useEffect(() => {
    fetchCounters();
  }, []);

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

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-6 md:p-10 font-sans relative overflow-hidden">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-[150px] pointer-events-none" />

      {/* Add Counter Dialog */}
      <AnimatePresence>
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
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Top Navigation / Breadcrumb */}
        <button className="flex items-center text-text-secondary hover:text-white transition-colors text-sm font-medium bg-[#222222] px-4 py-2.5 rounded-xl border border-transparent hover:border-[#333333]">
          <ArrowLeft className="w-4 h-4 mr-2 text-purple-400 animate-pulse" />
          Back to Dashboard
        </button>

        {/* Header Section */}
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

        {/* Table Section */}
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
    </div>
  );
}
