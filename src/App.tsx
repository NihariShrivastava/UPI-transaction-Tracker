import { useState } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import CounterDashboard from './pages/counter/CounterDashboard';
import CustomCursor from './components/ui/CustomCursor';

type AuthState = {
  isAuthenticated: boolean;
  role: 'admin' | 'counter' | null;
  username: string | null;
};

function App() {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('upi_auth_state');
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

  const handleLogin = (role: 'admin' | 'counter', username: string) => {
    const newState: AuthState = { isAuthenticated: true, role, username };
    setAuth(newState);
    localStorage.setItem('upi_auth_state', JSON.stringify(newState));
  };

  const handleLogout = () => {
    const newState: AuthState = { isAuthenticated: false, role: null, username: null };
    setAuth(newState);
    localStorage.removeItem('upi_auth_state');
  };

  return (
    <>
      <CustomCursor />
      {!auth.isAuthenticated && <Login onLogin={handleLogin} />}
      {auth.isAuthenticated && auth.role === 'admin' && <AdminDashboard onLogout={handleLogout} />}
      {auth.isAuthenticated && auth.role === 'counter' && <CounterDashboard username={auth.username || ''} onLogout={handleLogout} />}
    </>
  );
}

export default App;
