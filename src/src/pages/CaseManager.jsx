// src/src/pages/CaseManager.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import CaseTimeline from '../components/CaseTimeline';
import api from '../services/api';

const LEGAL_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const STATUS_STYLES = {
  intake: 'll-status-pending', investigation: 'll-status-pending', filing: 'll-status-active',
  hearing: 'll-status-closed', resolution: 'll-status-active', closed: 'll-status-closed'
};

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
    try { const { data } = await api.get('/cases'); setCases(data.cases); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCases(); }, []);

  const openCreateForm = async () => {
    try {
      if (clients.length === 0) { const { data } = await api.get('/users/clients'); setClients(data.clients); }
      setShowCreateForm(true);
    } catch { alert('Failed to load client list'); }
  };

  const createCase = async () => {
    if (!newCase.clientId || !newCase.title || !newCase.legalArea) { alert('Please fill in Client, Title, and Legal Area'); return; }
    setCreating(true);
    try {
      await api.post('/cases', newCase);
      setNewCase({ clientId: '', title: '', description: '', legalArea: '' });
      setShowCreateForm(false);
      fetchCases();
    } catch (err) { alert(err.response?.data?.message || 'Failed to create case'); }
    finally { setCreating(false); }
  };

  const loadCase = async (id) => {
    try { const { data } = await api.get(`/cases/${id}`); setSelectedCase(data.case); }
    catch (err) { alert(err.response?.data?.message || 'Failed to load case'); }
  };

  const addMilestone = async () => {
    if (!milestoneNote.trim()) return;
    try {
      await api.put(`/cases/${selectedCase._id}/milestone`, { note: milestoneNote, stage: selectedCase.status });
      setMilestoneNote('');
      loadCase(selectedCase._id);
    } catch (err) { alert(err.response?.data?.message || 'Failed to add milestone'); }
  };

  const advanceCase = async () => {
    const stages = ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'];
    const currentIdx = stages.indexOf(selectedCase.status);
    if (currentIdx >= stages.length - 1) return;
    const nextStage = stages[currentIdx + 1];
    if (window.confirm(`Advance case to "${nextStage}"?`)) {
      try {
        await api.put(`/cases/${selectedCase._id}/status`, { status: nextStage });
        loadCase(selectedCase._id);
      } catch (err) { alert(err.response?.data?.message || 'Failed to advance case'); }
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)' }}>Case Manager</h1>
        {isLawyer && (
          <button className="ll-btn ll-btn-primary" onClick={openCreateForm}>
            <i className="bi bi-plus" /> New Case
          </button>
        )}
      </div>

      {/* Create Case Form */}
      {showCreateForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="ll-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>Create New Case</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="ll-label">Client</label>
              <select className="ll-select" value={newCase.clientId}
                      onChange={e => setNewCase({...newCase, clientId: e.target.value})}>
                <option value="">Select a client...</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.name} ({c.email})</option>)}
              </select>
            </div>
            <div>
              <label className="ll-label">Legal Area</label>
              <select className="ll-select" value={newCase.legalArea}
                      onChange={e => setNewCase({...newCase, legalArea: e.target.value})}>
                <option value="">Select area...</option>
                {LEGAL_AREAS.map(area => <option key={area} value={area}>{area.charAt(0).toUpperCase() + area.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="ll-label">Case Title</label>
            <input className="ll-input" placeholder="e.g. Alimony Dispute - Kumar"
                   value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="ll-label">Description</label>
            <textarea className="ll-input" rows={2} placeholder="Brief case description..."
                      value={newCase.description} onChange={e => setNewCase({...newCase, description: e.target.value})}
                      style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="ll-btn ll-btn-primary" onClick={createCase} disabled={creating}>
              {creating ? 'Creating...' : 'Create Case'}
            </button>
            <button className="ll-btn ll-btn-outline" onClick={() => setShowCreateForm(false)}>Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="ll-case-grid">
        {/* Case list */}
        <div>
          {loading ? <div className="ll-spinner"><div className="spinner-border" style={{ color: 'var(--accent)' }} /></div> :
           cases.length === 0 ? (
            <div className="ll-empty"><i className="bi bi-folder" /><p>No cases yet.</p></div>
           ) : cases.map(c => (
            <motion.div key={c._id} whileHover={{ scale: 1.01 }}
                        className="ll-card" style={{
                          cursor: 'pointer', marginBottom: '8px', padding: '14px 16px',
                          borderColor: selectedCase?._id === c._id ? 'var(--accent)' : undefined
                        }}
                        onClick={() => loadCase(c._id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '0.85rem' }}>{c.title}</strong>
                <span className={`ll-status ${STATUS_STYLES[c.status] || ''}`}>{c.status}</span>
              </div>
              <small style={{ color: 'var(--text-muted)' }}>{c.caseNumber} · {c.legalArea}</small>
            </motion.div>
          ))}
        </div>

        {/* Case detail */}
        <div>
          {selectedCase ? (
            <div className="ll-card">
              <h2>{selectedCase.title}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {selectedCase.caseNumber} · {selectedCase.legalArea}
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>{selectedCase.description}</p>

              <CaseTimeline currentStatus={selectedCase.status} milestones={selectedCase.milestones} />

              {isLawyer && selectedCase.status !== 'closed' && (
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <input className="ll-input" placeholder="Add milestone note..."
                           value={milestoneNote} onChange={e => setMilestoneNote(e.target.value)} />
                    <button className="ll-btn ll-btn-outline" onClick={addMilestone}>Add</button>
                  </div>
                  <button className="ll-btn ll-btn-primary" onClick={advanceCase}>
                    Advance to Next Stage →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="ll-empty"><i className="bi bi-folder2-open" /><p>Select a case to view details</p></div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CaseManager;
