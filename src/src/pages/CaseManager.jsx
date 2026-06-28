import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import CaseTimeline from '../components/CaseTimeline';
import api from '../services/api';

const LEGAL_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const CaseManager = () => {
  const { user, isLawyer } = useAuth();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [milestoneNote, setMilestoneNote] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clients, setClients] = useState([]);
  const [newCase, setNewCase] = useState({ clientId: '', title: '', description: '', legalArea: '' });
  const [creating, setCreating] = useState(false);

  const fetchCases = async () => {
    const { data } = await api.get('/cases');
    setCases(data.cases);
    setLoading(false);
  };

  useEffect(() => { fetchCases(); }, []);

  const openCreateForm = async () => {
    if (clients.length === 0) {
      const { data } = await api.get('/users/clients');
      setClients(data.clients);
    }
    setShowCreateForm(true);
  };

  const createCase = async () => {
    if (!newCase.clientId || !newCase.title || !newCase.legalArea) {
      alert('Please fill in Client, Title, and Legal Area');
      return;
    }
    setCreating(true);
    try {
      await api.post('/cases', newCase);
      setNewCase({ clientId: '', title: '', description: '', legalArea: '' });
      setShowCreateForm(false);
      fetchCases();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const loadCase = async (id) => {
    const { data } = await api.get(`/cases/${id}`);
    setSelectedCase(data.case);
  };

  const addMilestone = async () => {
    if (!milestoneNote.trim()) return;
    await api.put(`/cases/${selectedCase._id}/milestone`, {
      note: milestoneNote,
      stage: selectedCase.status
    });
    setMilestoneNote('');
    loadCase(selectedCase._id);
  };

  const advanceCase = async () => {
    const stages = ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'];
    const currentIdx = stages.indexOf(selectedCase.status);
    if (currentIdx >= stages.length - 1) return;

    const nextStage = stages[currentIdx + 1];
    if (window.confirm(`Advance case to "${nextStage}"?`)) {
      await api.put(`/cases/${selectedCase._id}/status`, { status: nextStage });
      loadCase(selectedCase._id);
    }
  };

  const STATUS_COLORS = {
    intake: 'info', investigation: 'warning', filing: 'primary',
    hearing: 'dark', resolution: 'success', closed: 'secondary'
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0">Case Manager</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={openCreateForm}>
            + New Case
          </button>
        )}
      </div>

      {showCreateForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">Create New Case</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Client</label>
                <select className="form-select" value={newCase.clientId}
                        onChange={e => setNewCase({...newCase, clientId: e.target.value})}>
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Legal Area</label>
                <select className="form-select" value={newCase.legalArea}
                        onChange={e => setNewCase({...newCase, legalArea: e.target.value})}>
                  <option value="">Select area...</option>
                  {LEGAL_AREAS.map(area => (
                    <option key={area} value={area}>{area.charAt(0).toUpperCase() + area.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Case Title</label>
                <input className="form-control" placeholder="e.g. Alimony Dispute - Kumar"
                       value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} />
              </div>
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={2} placeholder="Brief case description..."
                          value={newCase.description} onChange={e => setNewCase({...newCase, description: e.target.value})} />
              </div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" onClick={createCase} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Case'}
                </button>
                <button className="btn btn-outline-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="row">
        <div className="col-md-4">
          {loading ? <div className="spinner-border" /> : cases.length === 0 ? (
            <div className="text-center text-muted py-4">No cases yet.</div>
          ) : cases.map(c => (
            <motion.div key={c._id} whileHover={{ scale: 1.02 }}
                        className={`card border-0 shadow-sm mb-2 ${selectedCase?._id === c._id ? 'border-primary border-2' : ''}`}
                        style={{ cursor: 'pointer', borderRadius: '10px' }}
                        onClick={() => loadCase(c._id)}>
              <div className="card-body py-2 px-3">
                <div className="d-flex justify-content-between">
                  <strong className="small">{c.title}</strong>
                  <span className={`badge bg-${STATUS_COLORS[c.status]}`} style={{ fontSize: 10 }}>{c.status}</span>
                </div>
                <small className="text-muted">{c.caseNumber} · {c.legalArea}</small>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="col-md-8">
          {selectedCase ? (
            <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <div className="card-body">
                <h4 className="fw-bold">{selectedCase.title}</h4>
                <p className="text-muted small">{selectedCase.caseNumber} · {selectedCase.legalArea}</p>
                <p>{selectedCase.description}</p>

                <CaseTimeline currentStatus={selectedCase.status} milestones={selectedCase.milestones} />

                {isLawyer && selectedCase.status !== 'closed' && (
                  <div className="mt-4 pt-3 border-top">
                    <div className="d-flex gap-2 mb-3">
                      <input className="form-control" placeholder="Add milestone note..."
                             value={milestoneNote} onChange={e => setMilestoneNote(e.target.value)} />
                      <button className="btn btn-outline-primary" onClick={addMilestone}>Add</button>
                    </div>
                    <button className="btn btn-success" onClick={advanceCase}>
                      Advance to Next Stage →
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted py-5">Select a case to view details</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseManager;
