import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS = {
  pending: 'warning', confirmed: 'primary',
  completed: 'success', cancelled: 'secondary', 'no-show': 'danger'
};

const ConsultationHub = () => {
  const { isLawyer } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchConsultations = async () => {
    setLoading(true);
    const params = {};
    if (filter) params.status = filter;
    const { data } = await api.get('/consultations', { params });
    setConsultations(data.consultations);
    setLoading(false);
  };

  useEffect(() => { fetchConsultations(); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/consultations/${id}`, { status });
      fetchConsultations();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    }
  };

  const startChat = async (userId) => {
    try {
      await api.post('/chat/conversations', { userId });
      navigate('/chat');
    } catch (err) {
      alert('Failed to start chat');
    }
  };

  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Consultation Queue</h2>

      <div className="d-flex gap-2 mb-4">
        {['', 'pending', 'confirmed', 'completed', 'cancelled'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-dark' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-5"><div className="spinner-border" /></div> : (
        consultations.length === 0 ? (
          <div className="text-center py-5 text-muted">No consultations found.</div>
        ) : (
          <div className="row g-3">
            {consultations.map((c, i) => (
              <motion.div key={c._id} className="col-md-6"
                          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}>
                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between mb-2">
                      <h6 className="fw-bold mb-0">{isLawyer ? c.client?.name : c.lawyer?.name}</h6>
                      <span className={`badge bg-${STATUS_COLORS[c.status]}`}>{c.status}</span>
                    </div>
                    <p className="text-muted small mb-1">
                      📅 {new Date(c.date).toLocaleDateString()} · 🕐 {c.timeSlot}
                    </p>
                    {c.reason && <p className="small mb-2">{c.reason}</p>}

                    <div className="d-flex gap-2">
                      {c.status === 'pending' && isLawyer && (
                        <button className="btn btn-sm btn-success" onClick={() => updateStatus(c._id, 'confirmed')}>Confirm</button>
                      )}
                      {c.status === 'pending' && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => updateStatus(c._id, 'cancelled')}>Cancel</button>
                      )}
                      {c.status === 'confirmed' && isLawyer && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => updateStatus(c._id, 'completed')}>Complete</button>
                          <button className="btn btn-sm btn-outline-warning" onClick={() => updateStatus(c._id, 'no-show')}>No-show</button>
                        </>
                      )}
                      <button className="btn btn-sm btn-outline-success"
                              onClick={() => startChat(isLawyer ? c.client?._id : c.lawyer?._id)}>💬 Chat</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default ConsultationHub;
