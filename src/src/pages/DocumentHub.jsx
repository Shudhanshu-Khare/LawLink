// src/src/pages/DocumentHub.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const DOC_TYPES = [
  { value: 'demand_letter', label: 'Demand Letter' },
  { value: 'contract', label: 'Contract' },
  { value: 'legal_notice', label: 'Legal Notice' },
  { value: 'court_brief', label: 'Court Brief' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'power_of_attorney', label: 'Power of Attorney' }
];

const STATUS_MAP = {
  draft: 'll-status-closed', issued: 'll-status-active',
  acknowledged: 'll-status-active', expired: 'll-status-pending', revoked: 'll-status-danger'
};

const downloadDocPDF = async (docId, title) => {
  try {
    const { data } = await api.get(`/documents/${docId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || 'document').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) { alert(err.response?.data?.message || 'Failed to download PDF'); }
};

const DocumentHub = () => {
  const { isLawyer } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ caseId: '', clientId: '', documentType: 'demand_letter', title: '', content: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const [docRes, caseRes] = await Promise.all([api.get('/documents'), api.get('/cases')]);
        setDocuments(docRes.data.documents);
        setCases(caseRes.data.cases);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const handleCaseSelect = (caseId) => {
    const selected = cases.find(c => c._id === caseId);
    setForm(prev => ({ ...prev, caseId, clientId: selected?.client?._id || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/documents', form);
      setShowForm(false);
      setForm({ caseId: '', clientId: '', documentType: 'demand_letter', title: '', content: '' });
      const { data } = await api.get('/documents');
      setDocuments(data.documents);
    } catch (err) { alert(err.response?.data?.message || 'Failed to create document'); }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke client access to this document?')) return;
    await api.put(`/documents/${id}/revoke`);
    const { data } = await api.get('/documents');
    setDocuments(data.documents);
  };

  if (loading) return <div className="ll-spinner"><div className="spinner-border" style={{ color: 'var(--accent)' }} /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)' }}>Legal Documents</h1>
        {isLawyer && (
          <button className="ll-btn ll-btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : <><i className="bi bi-plus" /> New Document</>}
          </button>
        )}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="ll-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>Create Document</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="ll-label">Case</label>
                <select className="ll-select" value={form.caseId} onChange={e => handleCaseSelect(e.target.value)} required>
                  <option value="">Select case...</option>
                  {cases.filter(c => c.status !== 'closed').map(c => (
                    <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ll-label">Document Type</label>
                <select className="ll-select" value={form.documentType} onChange={e => setForm({...form, documentType: e.target.value})}>
                  {DOC_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="ll-label">Title</label>
              <input className="ll-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                     placeholder="e.g., Demand Letter — Outstanding Payment" required />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="ll-label">Content</label>
              <textarea className="ll-input" rows={8} value={form.content} onChange={e => setForm({...form, content: e.target.value})}
                        placeholder="Enter the full legal document text here..." required style={{ resize: 'vertical' }} />
            </div>
            <button type="submit" className="ll-btn ll-btn-primary">Create Document + Generate PDF</button>
          </form>
        </motion.div>
      )}

      {documents.length === 0 ? (
        <div className="ll-empty"><i className="bi bi-file-earmark-text" /><p>No documents yet.</p></div>
      ) : (
        <div className="ll-grid-2">
          {documents.map((doc, i) => (
            <motion.div key={doc._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="ll-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.documentNumber}</span>
                  <span className={`ll-status ${STATUS_MAP[doc.status] || ''}`}>{doc.status}</span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{doc.title}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
                  {doc.documentType.replace(/_/g, ' ')} · Case: {doc.case?.caseNumber}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  {isLawyer ? `Client: ${doc.client?.name}` : `By: ${doc.lawyer?.name}`}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {doc.pdfUrl && (doc.status !== 'revoked' || isLawyer) && (
                    <button className="ll-btn ll-btn-sm ll-btn-outline" onClick={() => downloadDocPDF(doc._id, doc.title)}>
                      <i className="bi bi-download" /> PDF
                    </button>
                  )}
                  {doc.status === 'issued' && isLawyer && (
                    <button className="ll-btn ll-btn-sm ll-btn-outline" style={{ color: 'var(--danger)' }} onClick={() => handleRevoke(doc._id)}>Revoke</button>
                  )}
                  {doc.status === 'revoked' && !isLawyer && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>Access revoked by lawyer</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default DocumentHub;
