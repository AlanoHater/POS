import { useAuth } from './context/AuthContext';
import { Icon } from './components/ui';
import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';
import './pages/LoginPage.css';

export default function App() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="login-wrap">
        <div className="panel login-card loading">
          <div className="login-logo">
            <Icon name="store" size={22} />
          </div>
          <h1>Punto de Venta</h1>
          <p>Iniciando…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <PosPage />;
}
