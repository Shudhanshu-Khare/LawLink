// src/src/pages/DeadlineCalendar.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';

const TYPE_INFO = {
  court_date: { label: 'Court Date', icon: 'bi-building' },
  filing_deadline: { label: 'Filing Deadline', icon: 'bi-file-earmark' },
  statute_of_limitations: { label: 'Statute of Limitations', icon: 'bi-exclamation-triangle' },
  hearing_date: { label: 'Hearing Date', icon: 'bi-megaphone' },
  response_due: { label: 'Response Due', icon: 'bi-reply' }
};

const DeadlineCalendar = () => {
  const { isLawyer } = useAuth();
  const { socket } = useSocket();
  const [deadlines, setDeadlines] = useState([]);
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ caseId: '', title: '', description: '', deadlineDate: '', type: 'court_date' });

  useEffect(() => {
    const load = async () => {
      try {
        const [dlRes, caseRes] = await Promise.all([
          api.get('/deadlines', { params: { upcoming: 'true' } }), api.get('/cases')
        ]);
        setDeadlines(dlRes.data.deadlines);
        setCases(caseRes.data.cases);
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleReminder = (data) => {
      alert(`Deadline Reminder: ${data.title}\nCase: ${data.caseName}\nDate: ${new Date(data.deadlineDate).toLocaleDateString()}`);
    };
    socket.on('deadline:reminder', handleReminder);
    return () => socket.off('deadline:reminder', handleReminder);
  }, [socket]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/deadlines', form);
      setShowForm(false);
      setForm({ caseId: '', title: '', description: '', deadlineDate: '', type: 'court_date' });
      const { data } = await api.get('/deadlines', { params: { upcoming: 'true' } });
      setDeadlines(data.deadlines);
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this deadline?')) return;
    await api.delete(`/deadlines/${id}`);
    const { data } = await api.get('/deadlines', { params: { upcoming: 'true' } });
    setDeadlines(data.deadlines);
  };

  const getDaysUntil = (date) => {
    const diff = new Date(date) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)' }}>Deadlines</h1>
        {isLawyer && (
          <button className="ll-btn ll-btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : <><i className="bi bi-plus" /> Add Deadline</>}
          </button>
        )}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="ll-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>New Deadline</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="ll-label">Case</label>
                <select className="ll-select" value={form.caseId} onChange={e => setForm({...form, caseId: e.target.value})} required>
                  <option value="">Select case...</option>
                  {cases.filter(c => c.status !== 'closed').map(c => <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="ll-label">Type</label>
                <select className="ll-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  {Object.entries(TYPE_INFO).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                </select>
              </div>
              <div>
                <label className="ll-label">Title</label>
                <input className="ll-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div>
                <label className="ll-label">Date</label>
                <input type="date" className="ll-input" value={form.deadlineDate} onChange={e => setForm({...form, deadlineDate: e.target.value})} required />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="ll-label">Notes (optional)</label>
              <textarea className="ll-input" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ resize: 'vertical' }} />
            </div>
            <button type="submit" className="ll-btn ll-btn-primary">Add Deadline</button>
          </form>
        </motion.div>
      )}

      {deadlines.length === 0 ? (
        <div className="ll-empty"><i className="bi bi-clock" /><p>No upcoming deadlines.</p></div>
      ) : (
        <div className="ll-grid">
          {deadlines.map((dl, i) => {
            const typeInfo = TYPE_INFO[dl.type] || TYPE_INFO.court_date;
            const daysLeft = getDaysUntil(dl.deadlineDate);
            const isUrgent = new Date(dl.deadlineDate) - new Date() < 48 * 60 * 60 * 1000;

            return (
              <motion.div key={dl._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="ll-card" style={{ borderColor: isUrgent ? 'var(--danger)' : undefined, borderWidth: isUrgent ? '2px' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="ll-status ll-status-pending">
                      <i className={`bi ${typeInfo.icon}`} style={{ marginRight: '4px' }} />{typeInfo.label}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isUrgent ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {daysLeft}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>{dl.title}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 4px' }}>
                    {new Date(dl.deadlineDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 4px' }}>Case: {dl.case?.caseNumber}</p>
                  {dl.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 0' }}>{dl.description}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    {dl.reminderSent && <small style={{ color: 'var(--success)' }}>✓ Reminder sent</small>}
                    {isLawyer && (
                      <button className="ll-btn ll-btn-sm ll-btn-ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                              onClick={() => handleDelete(dl._id)}>Delete</button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default DeadlineCalendar;
