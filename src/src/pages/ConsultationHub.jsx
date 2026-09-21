// src/src/pages/ConsultationHub.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_MAP = {
  pending: 'll-status-pending', confirmed: 'll-status-active',
  completed: 'll-status-active', cancelled: 'll-status-closed', 'no-show': 'll-status-danger'
};

const ConsultationHub = () => {
  const { isLawyer } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await api.get('/consultations', { params });
      setConsultations(data.consultations);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchConsultations(); }, [filter]);

  const updateStatus = async (id, status) => {
    try { await api.put(`/consultations/${id}`, { status }); fetchConsultations(); }
    catch (err) { alert(err.response?.data?.message || 'Update failed'); }
  };

  const startChat = async (userId) => {
    try { await api.post('/chat/conversations', { userId }); navigate('/chat'); }
    catch { alert('Failed to start chat'); }
  };

  const filters = ['', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', marginBottom: '24px' }}>Consultations</h1>

      <div className="ll-tabs" style={{ borderBottom: 'none', marginBottom: '20px', gap: '8px' }}>
        {filters.map(s => (
          <button key={s} className={`ll-btn ll-btn-sm ${filter === s ? 'll-btn-primary' : 'll-btn-outline'}`}
                  onClick={() => setFilter(s)}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="ll-spinner"><div className="spinner-border" style={{ color: 'var(--accent)' }} /></div> :
       consultations.length === 0 ? (
        <div className="ll-empty"><i className="bi bi-calendar-x" /><p>No consultations found.</p></div>
       ) : (
        <div className="ll-grid-2">
          {consultations.map((c, i) => (
            <motion.div key={c._id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}>
              <div className="ll-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 600 }}>{isLawyer ? c.client?.name : c.lawyer?.name}</div>
                  <span className={`ll-status ${STATUS_MAP[c.status] || ''}`}>{c.status}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <i className="bi bi-calendar3" style={{ marginRight: '6px' }} />
                  {new Date(c.date).toLocaleDateString()} · {c.timeSlot}
                </p>
                {c.reason && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{c.reason}</p>}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {c.status === 'pending' && isLawyer && (
                    <button className="ll-btn ll-btn-sm ll-btn-primary" onClick={() => updateStatus(c._id, 'confirmed')}>Confirm</button>
                  )}
                  {c.status === 'pending' && (
                    <button className="ll-btn ll-btn-sm ll-btn-outline" onClick={() => updateStatus(c._id, 'cancelled')}>Cancel</button>
                  )}
                  {c.status === 'confirmed' && isLawyer && (
                    <>
                      <button className="ll-btn ll-btn-sm ll-btn-primary" onClick={() => updateStatus(c._id, 'completed')}>Complete</button>
                      <button className="ll-btn ll-btn-sm ll-btn-outline" onClick={() => updateStatus(c._id, 'no-show')}>No-show</button>
                    </>
                  )}
                  <button className="ll-btn ll-btn-sm ll-btn-outline"
                          onClick={() => startChat(isLawyer ? c.client?._id : c.lawyer?._id)}>
                    <i className="bi bi-chat" /> Chat
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ConsultationHub;
