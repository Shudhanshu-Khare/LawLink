import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import DeadlineBadge from './DeadlineBadge';
import api from '../services/api';

const Navbar = () => {
  const { user, isAuthenticated, isLawyer, isClient, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => { logout(); navigate('/login'); };

  const fetchUnread = async () => {
    try {
      const { data } = await api.get('/chat/unread-count');
      setUnreadCount(data.unreadCount);
    } catch {
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnread();

    const interval = setInterval(fetchUnread, location.pathname === '/chat' ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMsg = () => {
      if (location.pathname !== '/chat') {
        setUnreadCount(prev => prev + 1);
      }
    };
    socket.on('message:received', handleNewMsg);
    return () => socket.off('message:received', handleNewMsg);
  }, [socket, location.pathname]);

  const navLink = (to, label, showDot = false) => (
    <li className="nav-item" key={to}>
      <Link className={`nav-link ${location.pathname === to ? 'active fw-bold' : ''}`} to={to}
            style={{ position: 'relative' }}>
        {label}
        {showDot && (
          <span style={{
            position: 'absolute', top: 6, right: -2,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#ef4444', display: 'inline-block'
          }} />
        )}
      </Link>
    </li>
  );

  if (!isAuthenticated) return null;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark" style={{ background: '#0f172a' }}>
      <div className="container">
        <Link className="navbar-brand fw-bold" to="/dashboard">LawLink</Link>
        <button className="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#nav">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="nav">
          <ul className="navbar-nav me-auto">
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/cases', 'Cases')}
            {isClient && navLink('/lawyers', 'Find Lawyers')}
            {navLink('/consultations', 'Consultations')}
            {navLink('/documents', 'Documents')}
            {navLink('/invoices', 'Invoices')}
            {navLink('/deadlines', 'Deadlines')}
            {navLink('/chat', 'Chat', unreadCount > 0)}
          </ul>
          <div className="d-flex align-items-center gap-3">
            <DeadlineBadge />
            <Link to="/profile" className="text-light small text-decoration-none" style={{ cursor: 'pointer' }}>
              {user?.name} ({user?.role})
            </Link>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
