import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import Logo from '../components/ui/Logo';
import { supabase } from '../lib/supabase';

export default function Login({ onLogin }: { onLogin: (role: 'admin' | 'counter' | 'team_lead' | 'auditor', username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Pre-check for local admin account for robust failsafe
    if (username === 'admin' && password === 'admin@upi') { 
      onLogin('admin', username);
      return;
    }

    try {
      setLoading(true);

      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (dbError || !data) {
        // Fallback to hardcoded mock logins
        if (username.startsWith('counter') && password === 'counter123') { 
          onLogin('counter', username);
        } else if (username === 'test' && password === 'test1234') { 
          onLogin('counter', username);
        } else {
          setError('Invalid username or password');
        }
        return;
      }

      if (data.password !== password) {
        setError('Invalid username or password');
        return;
      }

      // Success! Optional increment of logins
      try {
        await supabase
          .from('users')
          .update({ logins: (data.logins || 0) + 1 })
          .eq('id', data.id);
      } catch (logErr) {
        console.error('Failed to update logins counter:', logErr);
      }

      onLogin(data.role as 'admin' | 'counter' | 'team_lead' | 'auditor', data.username);
    } catch (err) {
      console.error(err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Animated Background Elements */}
      <motion.div 
        className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-500/5 blur-[120px]"
        animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-white/5 blur-[120px]"
        animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating Login Box */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        whileHover={{ y: -5, scale: 1.02 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="w-full bg-[#111111]/90 backdrop-blur-xl border-[#222222] shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-purple-500/30 transition-colors duration-500">
          <CardHeader className="flex flex-col items-center text-center pb-6 pt-8">
            <Logo className="mb-2 scale-125" />
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              {error && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-sm text-danger bg-danger/10 border border-danger/20 rounded p-2 text-center">
                  {error}
                </motion.div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-md h-10 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  placeholder="Enter username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-md h-10 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  placeholder="Enter password"
                />
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-4">
                <Button type="submit" disabled={loading} className="w-full text-black flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
