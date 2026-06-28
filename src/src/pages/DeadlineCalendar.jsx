import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

const TYPE_COLORS = {
  court_date: { bg: '#dbeafe', text: '#1e40af', label: 'Court Date' },
  filing_deadline: { bg: '#fef3c7', text: '#92400e', label: 'Filing Deadline' },
  statute_of_limitations: { bg: '#fee2e2', text: '#991b1b', label: 'Statute of Limitations' },
  hearing_date: { bg: '#e0e7ff', text: '#3730a3', label: 'Hearing Date' },
  response_due: { bg: '#fce7f3', text: '#9d174d', label: 'Response Due' }
};

const DeadlineCalendar = () => {
  const { isLawyer } = useAuth();
  const { socket } = useSocket();
  const [deadlines, setDeadlines] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    caseId: '', title: '', description: '', deadlineDate: '', type: 'court_date'
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/deadlines', { params: { upcoming: 'true' } });
        setDeadlines(data.deadlines);
      } finally {
        setLoading(false);
      }
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
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const toggleForm = async () => {
    const nextValue = !showForm;
    setShowForm(nextValue);

    if (nextValue && isLawyer && cases.length === 0) {
      setCasesLoading(true);
      try {
        const { data } = await api.get('/cases');
        setCases(data.cases);
      } finally {
        setCasesLoading(false);
      }
    }
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
    <div className="container py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">Court Deadlines</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={toggleForm}>
            {showForm ? 'Cancel' : '+ Add Deadline'}
          </button>
        )}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Case</label>
                  <select className="form-select" value={form.caseId}
                          onChange={e => setForm({...form, caseId: e.target.value})} required>
                    <option value="">Select case...</option>
                    {casesLoading && <option disabled>Loading cases...</option>}
                    {!casesLoading && cases.filter(c => c.status !== 'closed').map(c => (
                      <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.type}
                          onChange={e => setForm({...form, type: e.target.value})}>
                    {Object.entries(TYPE_COLORS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={form.title}
                         onChange={e => setForm({...form, title: e.target.value})} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.deadlineDate}
                         onChange={e => setForm({...form, deadlineDate: e.target.value})} required />
                </div>
                <div className="col-12">
                  <label className="form-label">Notes (optional)</label>
                  <textarea className="form-control" rows={2} value={form.description}
                            onChange={e => setForm({...form, description: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="btn btn-success mt-3">Add Deadline</button>
            </form>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : deadlines.length === 0 ? (
        <p className="text-muted">No upcoming deadlines.</p>
      ) : (
        <div className="row g-3">
          {deadlines.map((dl, i) => {
            const typeInfo = TYPE_COLORS[dl.type] || TYPE_COLORS.court_date;
            const daysLeft = getDaysUntil(dl.deadlineDate);
            const isUrgent = new Date(dl.deadlineDate) - new Date() < 48 * 60 * 60 * 1000;

            return (
              <motion.div key={dl._id} className="col-md-6 col-lg-4"
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>
                <div className={`card border-0 shadow-sm h-100 ${isUrgent ? 'border-danger border-2' : ''}`}
                     style={{ borderRadius: '12px' }}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="badge" style={{ background: typeInfo.bg, color: typeInfo.text }}>
                        {typeInfo.label}
                      </span>
                      <span className={`fw-bold small ${isUrgent ? 'text-danger' : 'text-muted'}`}>
                        {daysLeft}
                      </span>
                    </div>
                    <h6 className="fw-bold">{dl.title}</h6>
                    <p className="text-muted small mb-1">
                      {new Date(dl.deadlineDate).toLocaleDateString('en-IN', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </p>
                    <p className="text-muted small mb-1">
                      Case: {dl.case?.caseNumber}
                    </p>
                    {dl.description && <p className="small mb-1">{dl.description}</p>}
                    <div className="d-flex justify-content-between align-items-center">
                      {dl.reminderSent && (
                        <small className="text-success">✓ Reminder sent</small>
                      )}
                      {isLawyer && (
                        <button className="btn btn-sm btn-outline-danger ms-auto"
                                onClick={() => handleDelete(dl._id)}>Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeadlineCalendar;
