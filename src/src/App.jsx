import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';

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

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="text-center mt-5"><div className="spinner-border" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
};

const Dashboard = () => {
  const { user, isLawyer, isClient } = useAuth();
  return (
    <div className="container py-5">
      <div className="mb-4">
        <h2 className="fw-bold">Welcome, {user?.name}!</h2>
        <p className="text-muted">Role: <span className="badge bg-primary">{user?.role}</span> · {user?.email}</p>
      </div>

      <div className="row g-3">
        {isClient && (
          <div className="col-md-4">
            <a href="/lawyers" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
              <div className="card-body text-center py-4">
                <div style={{ fontSize: 32 }}>🔍</div>
                <h6 className="fw-bold mt-2 text-dark">Find Lawyers</h6>
                <p className="text-muted small mb-0">Browse and book consultations</p>
              </div>
            </a>
          </div>
        )}
        <div className="col-md-4">
          <a href="/cases" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>📋</div>
              <h6 className="fw-bold mt-2 text-dark">My Cases</h6>
              <p className="text-muted small mb-0">Track case progress and milestones</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/consultations" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>📅</div>
              <h6 className="fw-bold mt-2 text-dark">Consultations</h6>
              <p className="text-muted small mb-0">View and manage appointments</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/chat" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>💬</div>
              <h6 className="fw-bold mt-2 text-dark">Messages</h6>
              <p className="text-muted small mb-0">Real-time chat with {isLawyer ? 'clients' : 'lawyers'}</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/documents" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>📄</div>
              <h6 className="fw-bold mt-2 text-dark">Documents</h6>
              <p className="text-muted small mb-0">{isLawyer ? 'Create legal documents & PDFs' : 'View your legal documents'}</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/invoices" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>💰</div>
              <h6 className="fw-bold mt-2 text-dark">Invoices</h6>
              <p className="text-muted small mb-0">{isLawyer ? 'Generate and track invoices' : 'View and pay invoices'}</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/deadlines" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>⏰</div>
              <h6 className="fw-bold mt-2 text-dark">Deadlines</h6>
              <p className="text-muted small mb-0">Court dates and filing deadlines</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />} />

      <Route path="/lawyers" element={<LawyerDirectory />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/book/:lawyerId" element={<ProtectedRoute roles={['client']}><BookConsultation /></ProtectedRoute>} />
      <Route path="/consultations" element={<ProtectedRoute><ConsultationHub /></ProtectedRoute>} />
      <Route path="/cases" element={<ProtectedRoute><CaseManager /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentHub /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><InvoiceManager /></ProtectedRoute>} />
      <Route path="/deadlines" element={<ProtectedRoute><DeadlineCalendar /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
