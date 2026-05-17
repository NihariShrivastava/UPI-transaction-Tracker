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
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    username: null,
  });

  const handleLogin = (role: 'admin' | 'counter', username: string) => {
    setAuth({ isAuthenticated: true, role, username });
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, role: null, username: null });
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
