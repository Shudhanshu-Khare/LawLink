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
  const [actionLoading, setActionLoading] = useState(null);

  const fetchStats = async () => { try { const { data } = await api.get('/admin/stats'); setStats(data.stats); } catch {} };
  const fetchPending = async () => { try { const { data } = await api.get('/admin/pending'); setPending(data.users); } catch {} };
  const fetchLawyers = async () => { try { const { data } = await api.get('/admin/lawyers'); setLawyers(data.lawyers); } catch {} };
  const fetchClients = async () => { try { const { data } = await api.get('/admin/clients'); setClients(data.clients); } catch {} };

  const refreshAll = () => Promise.all([fetchStats(), fetchPending(), fetchLawyers(), fetchClients()]);

  useEffect(() => { refreshAll().then(() => setLoading(false)); }, []);

  const handleVerify = async (userId, userName) => {
    if (!window.confirm(`Verify ${userName}? They will get full platform access.`)) return;
    setActionLoading(userId);
    try { await api.put(`/admin/verify/${userId}`); await refreshAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to verify user'); }
    finally { setActionLoading(null); }
  };

  const handleBlock = async (userId, userName) => {
    if (!window.confirm(`Block ${userName}? They won't be able to log in.`)) return;
    setActionLoading(userId);
    try { await api.put(`/admin/block/${userId}`); await refreshAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to block user'); }
    finally { setActionLoading(null); }
  };

  const handleUnblock = async (userId, userName) => {
    if (!window.confirm(`Unblock ${userName}?`)) return;
    setActionLoading(userId);
    try { await api.put(`/admin/unblock/${userId}`); await refreshAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to unblock user'); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${userName}?\n\nThis will delete all their data.\nThis action CANNOT be undone!`)) return;
    if (!window.confirm(`Are you ABSOLUTELY sure?`)) return;
    setActionLoading(userId);
    try {
      const { data } = await api.delete(`/admin/users/${userId}`);
      alert(`Deleted: ${JSON.stringify(data.deletedData, null, 2)}`);
      await refreshAll();
    } catch (err) { alert(err.response?.data?.message || 'Failed to delete user'); }
    finally { setActionLoading(null); }
  };

  const StatusBadge = ({ isVerified, isBlocked }) => {
    if (isBlocked) return <span className="ll-status ll-status-danger">Blocked</span>;
    if (isVerified) return <span className="ll-status ll-status-active">Verified</span>;
    return <span className="ll-status ll-status-pending">Pending</span>;
  };

  const AuthBadge = ({ authMethod, email }) => {
    if (email?.endsWith('@lawlink.com') || email?.endsWith('@test.com'))
      return <span className="ll-status ll-status-closed">Test</span>;
    if (authMethod === 'google') return <span className="ll-status ll-status-active">Google</span>;
    return <span className="ll-status ll-status-closed">Email</span>;
  };

  const ActionButtons = ({ user }) => (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {!user.isVerified && !user.isBlocked && (
        <button className="ll-btn ll-btn-sm ll-btn-primary" disabled={actionLoading === user._id}
                onClick={() => handleVerify(user._id, user.name)}>
          {actionLoading === user._id ? '...' : '✓ Verify'}
        </button>
      )}
      {!user.isBlocked ? (
        <button className="ll-btn ll-btn-sm ll-btn-outline" disabled={actionLoading === user._id}
                onClick={() => handleBlock(user._id, user.name)}>
          {actionLoading === user._id ? '...' : 'Block'}
        </button>
      ) : (
        <button className="ll-btn ll-btn-sm ll-btn-outline" disabled={actionLoading === user._id}
                onClick={() => handleUnblock(user._id, user.name)}>
          {actionLoading === user._id ? '...' : 'Unblock'}
        </button>
      )}
      <button className="ll-btn ll-btn-sm ll-btn-danger" disabled={actionLoading === user._id}
              onClick={() => handleDelete(user._id, user.name)} style={{ fontSize: '0.75rem' }}>
        {actionLoading === user._id ? '...' : 'Delete'}
      </button>
    </div>
  );

  const UserTable = ({ users, showRole = false }) => (
    <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="ll-table-wrap">
      <table className="ll-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            {showRole && <th>Role</th>}
            <th>Via</th>
            <th>Status</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr><td colSpan={showRole ? 7 : 6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No users found</td></tr>
          ) : users.map(user => (
            <tr key={user._id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="ll-avatar" style={{ width: 30, height: 30, fontSize: '0.75rem' }}>
                    {user.name?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user.name}</div>
                    {user.location?.city && <small style={{ color: 'var(--text-muted)' }}>{user.location.city}</small>}
                  </div>
                </div>
              </td>
              <td><small>{user.email}</small></td>
              {showRole && <td><span className="ll-badge">{user.role}</span></td>}
              <td><AuthBadge authMethod={user.authMethod} email={user.email} /></td>
              <td><StatusBadge isVerified={user.isVerified} isBlocked={user.isBlocked} /></td>
              <td><small>{new Date(user.createdAt).toLocaleDateString('en-IN')}</small></td>
              <td><ActionButtons user={user} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

  if (loading) return <div className="ll-spinner"><div className="spinner-border" style={{ color: 'var(--accent)' }} /></div>;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'pending', label: `Pending (${pending.length})` },
    { key: 'lawyers', label: `Lawyers (${lawyers.length})` },
    { key: 'clients', label: `Clients (${clients.length})` }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="ll-page-header">
        <h1>Admin Panel</h1>
      </div>

      {/* Tabs */}
      <div className="ll-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`ll-tab ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>

          {tab === 'overview' && stats && (
            <div className="ll-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[
                { label: 'Verified Lawyers', value: stats.verifiedLawyers, icon: 'bi-people' },
                { label: 'Verified Clients', value: stats.verifiedClients, icon: 'bi-person-badge' },
                { label: 'Pending Verifications', value: stats.pendingVerifications, icon: 'bi-shield-check', cls: 'success' },
                { label: 'Blocked Users', value: stats.blockedUsers, icon: 'bi-slash-circle', cls: 'danger' }
              ].map((card, i) => (
                <div key={i} className="ll-card ll-stat">
                  <div className="ll-card-icon"><i className={`bi ${card.icon}`} /></div>
                  <div className={`ll-stat-number ${card.cls || ''}`}>{card.value}</div>
                  <div className="ll-stat-label">{card.label}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'pending' && (
            pending.length === 0 ? (
              <div className="ll-empty">
                <i className="bi bi-check-circle" />
                <h3>No pending verifications</h3>
                <p>All users have been reviewed</p>
              </div>
            ) : <UserTable users={pending} showRole />
          )}

          {tab === 'lawyers' && <UserTable users={lawyers} />}
          {tab === 'clients' && <UserTable users={clients} />}

        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminDashboard;
