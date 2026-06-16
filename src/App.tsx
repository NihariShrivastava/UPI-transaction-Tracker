import { useState } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import CounterDashboard from './pages/counter/CounterDashboard';
import TeamLeadDashboard from './pages/team_lead/TeamLeadDashboard';
import AuditorDashboard from './pages/auditor/AuditorDashboard';

type AuthState = {
  isAuthenticated: boolean;
  role: 'admin' | 'counter' | 'team_lead' | 'auditor' | null;
  username: string | null;
};

function App() {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = sessionStorage.getItem('upi_auth_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved auth state', e);
      }
    }
    return {
      isAuthenticated: false,
      role: null,
      username: null,
    };
  });

  const handleLogin = (role: 'admin' | 'counter' | 'team_lead' | 'auditor', username: string) => {
    const newState: AuthState = { isAuthenticated: true, role, username };
    setAuth(newState);
    sessionStorage.setItem('upi_auth_state', JSON.stringify(newState));
  };

  const handleLogout = () => {
    const newState: AuthState = { isAuthenticated: false, role: null, username: null };
    setAuth(newState);
    sessionStorage.removeItem('upi_auth_state');
  };

  return (
    <>
      {!auth.isAuthenticated && <Login onLogin={handleLogin} />}
      {auth.isAuthenticated && auth.role === 'admin' && <AdminDashboard onLogout={handleLogout} />}
      {auth.isAuthenticated && auth.role === 'counter' && <CounterDashboard username={auth.username || ''} onLogout={handleLogout} />}
      {auth.isAuthenticated && auth.role === 'team_lead' && <TeamLeadDashboard username={auth.username || ''} onLogout={handleLogout} />}
      {auth.isAuthenticated && auth.role === 'auditor' && <AuditorDashboard username={auth.username || ''} onLogout={handleLogout} />}
    </>
  );
}

export default App;
