// src/src/components/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import api from '../services/api';

const Sidebar = () => {
  const { user, logout: authLogout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    authLogout();
    navigate('/login');
  };

  // Nav items per role
  const clientNav = [
    { to: '/dashboard', icon: 'bi-house-fill', label: 'Dashboard' },
    { to: '/cases', icon: 'bi-folder', label: 'Cases' },
    { to: '/lawyers', icon: 'bi-search', label: 'Find Lawyers' },
    { to: '/consultations', icon: 'bi-calendar-check', label: 'Consultations' },
    { to: '/documents', icon: 'bi-file-earmark-text', label: 'Documents' },
    { to: '/invoices', icon: 'bi-receipt', label: 'Invoices' },
    { to: '/deadlines', icon: 'bi-clock', label: 'Deadlines' },
    { to: '/chat', icon: 'bi-chat-square', label: 'Messages' },
  ];

  const lawyerNav = [
    { to: '/dashboard', icon: 'bi-house-fill', label: 'Dashboard' },
    { to: '/cases', icon: 'bi-folder', label: 'Cases' },
    { to: '/consultations', icon: 'bi-calendar-check', label: 'Consultations' },
    { to: '/documents', icon: 'bi-file-earmark-text', label: 'Documents' },
    { to: '/invoices', icon: 'bi-receipt', label: 'Invoices' },
    { to: '/deadlines', icon: 'bi-clock', label: 'Deadlines' },
    { to: '/chat', icon: 'bi-chat-square', label: 'Messages' },
  ];

  const adminNav = [
    { to: '/admin', icon: 'bi-gear-fill', label: 'Admin Panel' },
    { to: '/admin?tab=pending', icon: 'bi-shield-check', label: 'Verifications' },
    { to: '/admin?tab=lawyers', icon: 'bi-people', label: 'Lawyers' },
    { to: '/admin?tab=clients', icon: 'bi-person-badge', label: 'Clients' },
  ];

  const navItems = user?.role === 'admin' ? adminNav
    : user?.role === 'lawyer' ? lawyerNav
    : clientNav;

  return (
    <>
      {/* Mobile toggle */}
      <button className="ll-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
        <i className={`bi ${mobileOpen ? 'bi-x' : 'bi-list'}`} />
      </button>

      <aside className={`ll-sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <NavLink to="/dashboard" className="ll-sidebar-logo" onClick={() => setMobileOpen(false)}>
          LawLink
        </NavLink>

        {/* Nav */}
        <ul className="ll-sidebar-nav">
          {navItems.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/dashboard' || item.to === '/admin'}
                className={({ isActive }) => `ll-sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <i className={`bi ${item.icon}`} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Profile & Logout at bottom */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
          <NavLink
            to="/profile"
            className={({ isActive }) => `ll-sidebar-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <i className="bi bi-person" />
            Profile
          </NavLink>
          <button className="ll-sidebar-item" onClick={handleLogout}>
            <i className="bi bi-box-arrow-left" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }}
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
