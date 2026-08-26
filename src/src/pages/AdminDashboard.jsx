// src/src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const AdminDashboard = () => {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // tracks which user action is in progress

  // ── Data Fetching ──
  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchPending = async () => {
    try {
      const { data } = await api.get('/admin/pending');
      setPending(data.users);
    } catch (err) {
      console.error('Failed to fetch pending:', err);
    }
  };

  const fetchLawyers = async () => {
    try {
      const { data } = await api.get('/admin/lawyers');
      setLawyers(data.lawyers);
    } catch (err) {
      console.error('Failed to fetch lawyers:', err);
    }
  };

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/admin/clients');
      setClients(data.clients);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([fetchStats(), fetchPending(), fetchLawyers(), fetchClients()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // ── Admin Actions ──
  const handleVerify = async (userId, userName) => {
    if (!window.confirm(`Verify ${userName}? They will get full platform access.`)) return;
    setActionLoading(userId);
    try {
      await api.put(`/admin/verify/${userId}`);
      await Promise.all([fetchStats(), fetchPending(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to verify user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (userId, userName) => {
    if (!window.confirm(`Block ${userName}? They won't be able to log in.`)) return;
    setActionLoading(userId);
    try {
      await api.put(`/admin/block/${userId}`);
      await Promise.all([fetchStats(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to block user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (userId, userName) => {
    if (!window.confirm(`Unblock ${userName}?`)) return;
    setActionLoading(userId);
    try {
      await api.put(`/admin/unblock/${userId}`);
      await Promise.all([fetchStats(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unblock user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId, userName) => {
    const confirmed = window.confirm(
      `⚠️ PERMANENTLY DELETE ${userName}?\n\n` +
      `This will delete:\n` +
      `• Their account\n` +
      `• All cases they're involved in\n` +
      `• All consultations\n` +
      `• All documents & invoices\n` +
      `• All chat messages\n\n` +
      `This action CANNOT be undone!`
    );
    if (!confirmed) return;

    // Double confirm for safety
    const doubleConfirm = window.confirm(`Are you ABSOLUTELY sure? Type OK to confirm deletion of ${userName}.`);
    if (!doubleConfirm) return;

    setActionLoading(userId);
    try {
      const { data } = await api.delete(`/admin/users/${userId}`);
      alert(`Deleted: ${JSON.stringify(data.deletedData, null, 2)}`);
      await Promise.all([fetchStats(), fetchPending(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reusable Components ──
  const StatusBadge = ({ isVerified, isBlocked }) => {
    if (isBlocked) return <span className="badge bg-danger">Blocked</span>;
    if (isVerified) return <span className="badge bg-success">Verified</span>;
    return <span className="badge bg-warning text-dark">Pending</span>;
  };

  // Helper to show how user registered
  const AuthBadge = ({ authMethod, email }) => {
    if (email?.endsWith('@lawlink.com') || email?.endsWith('@test.com')) {
      return <span className="badge bg-secondary">Test Account</span>;
    }
    if (authMethod === 'google') return <span className="badge bg-danger">Google</span>;
    return <span className="badge bg-dark">Email & Password</span>;
  };

  const ActionButtons = ({ user }) => (
    <div className="d-flex gap-1 flex-wrap">
      {!user.isVerified && !user.isBlocked && (
        <button className="btn btn-sm btn-success" disabled={actionLoading === user._id}
                onClick={() => handleVerify(user._id, user.name)}>
          {actionLoading === user._id ? '...' : '✓ Verify'}
        </button>
      )}
      {!user.isBlocked ? (
        <button className="btn btn-sm btn-warning" disabled={actionLoading === user._id}
                onClick={() => handleBlock(user._id, user.name)}>
          {actionLoading === user._id ? '...' : '🚫 Block'}
        </button>
      ) : (
        <button className="btn btn-sm btn-info" disabled={actionLoading === user._id}
                onClick={() => handleUnblock(user._id, user.name)}>
          {actionLoading === user._id ? '...' : '🔓 Unblock'}
        </button>
      )}
      <button className="btn btn-sm btn-outline-danger" disabled={actionLoading === user._id}
              onClick={() => handleDelete(user._id, user.name)}>
        {actionLoading === user._id ? '...' : '🗑️ Delete'}
      </button>
    </div>
  );

  const UserTable = ({ users, showRole = false }) => (
    <div className="table-responsive">
      <table className="table table-hover align-middle">
        <thead className="table-dark">
          <tr>
            <th>Name</th>
            <th>Email</th>
            {showRole && <th>Role</th>}
            <th>Registered Via</th>
            <th>Status</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr><td colSpan={showRole ? 7 : 6} className="text-center text-muted py-4">No users found</td></tr>
          ) : users.map(user => (
            <tr key={user._id}>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                       style={{ width: 32, height: 32, fontSize: 14 }}>
                    {user.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="fw-semibold">{user.name}</div>
                    {user.location?.city && <small className="text-muted">{user.location.city}</small>}
                  </div>
                </div>
              </td>
              <td><small>{user.email}</small></td>
              {showRole && <td><span className={`badge ${user.role === 'lawyer' ? 'bg-primary' : 'bg-info'}`}>{user.role}</span></td>}
              <td><AuthBadge authMethod={user.authMethod} email={user.email} /></td>
              <td><StatusBadge isVerified={user.isVerified} isBlocked={user.isBlocked} /></td>
              <td><small>{new Date(user.createdAt).toLocaleDateString('en-IN')}</small></td>
              <td><ActionButtons user={user} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">⚙️ Admin Panel</h2>
          <p className="text-muted mb-0">Manage users, verifications, and platform activity</p>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills mb-4">
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'pending', label: `⏳ Pending (${pending.length})` },
          { key: 'lawyers', label: `👨‍⚖️ Lawyers (${lawyers.length})` },
          { key: 'clients', label: `👤 Clients (${clients.length})` }
        ].map(t => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`}
                    onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

          {/* ── Overview Tab ── */}
          {tab === 'overview' && stats && (
            <div className="row g-3">
              {[
                { label: 'Verified Lawyers', value: stats.verifiedLawyers, color: 'primary', icon: '👨‍⚖️' },
                { label: 'Verified Clients', value: stats.verifiedClients, color: 'info', icon: '👤' },
                { label: 'Pending Verifications', value: stats.pendingVerifications, color: 'warning', icon: '⏳' },
                { label: 'Blocked Users', value: stats.blockedUsers, color: 'danger', icon: '🚫' }
              ].map((card, i) => (
                <div className="col-md-3 col-sm-6" key={i}>
                  <div className={`card border-${card.color} h-100`}>
                    <div className="card-body text-center">
                      <div style={{ fontSize: 32 }}>{card.icon}</div>
                      <h2 className={`fw-bold text-${card.color} mb-1`}>{card.value}</h2>
                      <p className="text-muted mb-0">{card.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Pending Tab ── */}
          {tab === 'pending' && (
            <>
              {pending.length === 0 ? (
                <div className="text-center py-5">
                  <div style={{ fontSize: 48 }}>✅</div>
                  <h5 className="mt-3">No pending verifications</h5>
                  <p className="text-muted">All users have been reviewed</p>
                </div>
              ) : (
                <UserTable users={pending} showRole />
              )}
            </>
          )}

          {/* ── Lawyers Tab ── */}
          {tab === 'lawyers' && <UserTable users={lawyers} />}

          {/* ── Clients Tab ── */}
          {tab === 'clients' && <UserTable users={clients} />}

        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminDashboard;
