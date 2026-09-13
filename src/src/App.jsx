// src/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Sidebar from './components/Sidebar';
import 'bootstrap/dist/css/bootstrap.min.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import LawyerDirectory from './pages/LawyerDirectory';
import BookConsultation from './pages/BookConsultation';
import ConsultationHub from './pages/ConsultationHub';
import CaseManager from './pages/CaseManager';
import Chat from './pages/Chat';
import DocumentHub from './pages/DocumentHub';
import InvoiceManager from './pages/InvoiceManager';
import DeadlineCalendar from './pages/DeadlineCalendar';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

// Protected route wrapper
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return (
    <div className="ll-spinner"><div className="spinner-border" style={{ color: 'var(--accent)' }} /></div>
  );
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user.role === 'admin' && (!roles || !roles.includes('admin'))) return <Navigate to="/admin" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
};

// ── Top Bar (user info on the right) ──
const TopBar = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="ll-topbar">
      <div className="ll-topbar-user">
        <div style={{ textAlign: 'right' }}>
          <div className="ll-topbar-name">{user.name} ({user.role})</div>
        </div>
        <Link to="/profile" className="ll-avatar" style={{ textDecoration: 'none' }}>
          {user.name?.charAt(0).toUpperCase()}
        </Link>
      </div>
    </div>
  );
};

// ── Dashboard Card ──
const DashCard = ({ to, icon, title, desc }) => (
  <Link to={to} className="ll-card ll-card-link">
    <div className="ll-card-header">
      <div>
        <div className="ll-card-icon"><i className={`bi ${icon}`} /></div>
        <div className="ll-card-title">{title}</div>
        <p className="ll-card-desc">{desc}</p>
      </div>
      <span className="ll-card-arrow">→</span>
    </div>
  </Link>
);

// ── Dashboard ──
const Dashboard = () => {
  const { user, isLawyer, isClient } = useAuth();
  const showVerificationBanner = user && !user.isVerified && user.role !== 'admin';

  const clientCards = [
    { to: '/cases', icon: 'bi-folder', title: 'My Cases', desc: 'Track case progress and milestones.' },
    { to: '/lawyers', icon: 'bi-search', title: 'Find Lawyers', desc: 'Browse and book consultations.' },
    { to: '/consultations', icon: 'bi-calendar-check', title: 'Consultations', desc: 'View and manage appointments.' },
    { to: '/documents', icon: 'bi-file-earmark-text', title: 'Documents', desc: 'View your legal documents.' },
    { to: '/invoices', icon: 'bi-receipt', title: 'Invoices', desc: 'View and pay invoices.' },
    { to: '/deadlines', icon: 'bi-clock', title: 'Deadlines', desc: 'Court dates and filing deadlines.' },
  ];

  const lawyerCards = [
    { to: '/cases', icon: 'bi-folder', title: 'My Cases', desc: 'Track case progress and milestones.' },
    { to: '/consultations', icon: 'bi-calendar-check', title: 'Consultations', desc: 'View and manage appointments.' },
    { to: '/chat', icon: 'bi-chat-square', title: 'Messages', desc: 'Real-time chat with clients.' },
    { to: '/documents', icon: 'bi-file-earmark-text', title: 'Documents', desc: 'Create and manage your legal documents.' },
    { to: '/invoices', icon: 'bi-receipt', title: 'Invoices', desc: 'Generate and track invoices.' },
    { to: '/deadlines', icon: 'bi-clock', title: 'Deadlines', desc: 'Court dates and filing deadlines.' },
  ];

  const cards = isLawyer ? lawyerCards : clientCards;

  return (
    <>
      {showVerificationBanner && (
        <div className="ll-alert ll-alert-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>⏳</span>
          <div>
            <strong>Profile Pending Verification</strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
              Your account is being reviewed by an admin.
              {isClient ? ' You can browse lawyers but cannot book consultations until verified.' :
                ' Your profile will appear in Find Lawyers once verified.'}
            </p>
          </div>
        </div>
      )}

      <div className="ll-page-header">
        <h1>Welcome back, {user?.name}!</h1>
        <div className="ll-page-meta">
          <span>Role: <span className="ll-badge">{user?.role}</span></span>
          <span>|</span>
          <span>{user?.email}</span>
        </div>
      </div>

      <div className="ll-grid">
        {cards.map(card => (
          <DashCard key={card.to} {...card} />
        ))}
      </div>
    </>
  );
};

// ── Layout wrapper: Sidebar + TopBar + Content ──
const AuthenticatedLayout = ({ children }) => (
  <>
    <Sidebar />
    <div className="ll-main">
      <TopBar />
      {children}
    </div>
  </>
);

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const defaultRoute = isAuthenticated && user?.role === 'admin' ? '/admin' : '/dashboard';

  // Public pages (no sidebar)
  const publicPaths = ['/login', '/register'];
  const isPublicPage = publicPaths.some(p => location.pathname.startsWith(p));

  // Lawyer Directory is special — public but optionally with sidebar
  const isLawyerDir = location.pathname === '/lawyers' && !isAuthenticated;

  if (isPublicPage || isLawyerDir) {
    return (
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <Register />} />
        <Route path="/lawyers" element={<LawyerDirectory />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <AuthenticatedLayout>
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/lawyers" element={<LawyerDirectory />} />
        <Route path="/book/:lawyerId" element={<ProtectedRoute roles={['client']}><BookConsultation /></ProtectedRoute>} />
        <Route path="/consultations" element={<ProtectedRoute><ConsultationHub /></ProtectedRoute>} />
        <Route path="/cases" element={<ProtectedRoute><CaseManager /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><DocumentHub /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><InvoiceManager /></ProtectedRoute>} />
        <Route path="/deadlines" element={<ProtectedRoute><DeadlineCalendar /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={defaultRoute} />} />
      </Routes>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProviderWrapper />
      </AuthProvider>
    </Router>
  );
}

function SocketProviderWrapper() {
  return (
    <SocketProvider>
      <AppRoutes />
    </SocketProvider>
  );
}

export default App;
