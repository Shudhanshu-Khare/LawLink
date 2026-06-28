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

const STATUS_COLORS = {
  draft: 'secondary', issued: 'primary', acknowledged: 'success',
  expired: 'warning', revoked: 'danger'
};

const DocumentHub = () => {
  const { isLawyer } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    caseId: '', clientId: '', documentType: 'demand_letter', title: '', content: ''
  });

  useEffect(() => {
    const load = async () => {
      const [docRes, caseRes] = await Promise.all([
        api.get('/documents'),
        api.get('/cases')
      ]);
      setDocuments(docRes.data.documents);
      setCases(caseRes.data.cases);
      setLoading(false);
    };
    load();
  }, []);

  const handleCaseSelect = (caseId) => {
    const selected = cases.find(c => c._id === caseId);
    setForm(prev => ({
      ...prev,
      caseId,
      clientId: selected?.client?._id || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/documents', form);
      setShowForm(false);
      setForm({ caseId: '', clientId: '', documentType: 'demand_letter', title: '', content: '' });
      const { data } = await api.get('/documents');
      setDocuments(data.documents);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create document');
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke client access to this document?')) return;
    await api.put(`/documents/${id}/revoke`);
    const { data } = await api.get('/documents');
    setDocuments(data.documents);
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">Legal Documents</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Document'}
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
                          onChange={e => handleCaseSelect(e.target.value)} required>
                    <option value="">Select case...</option>
                    {cases.filter(c => c.status !== 'closed').map(c => (
                      <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Document Type</label>
                  <select className="form-select" value={form.documentType}
                          onChange={e => setForm({...form, documentType: e.target.value})}>
                    {DOC_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={form.title}
                         onChange={e => setForm({...form, title: e.target.value})}
                         placeholder="e.g., Demand Letter — Outstanding Payment" required />
                </div>
                <div className="col-12">
                  <label className="form-label">Content</label>
                  <textarea className="form-control" rows={8} value={form.content}
                            onChange={e => setForm({...form, content: e.target.value})}
                            placeholder="Enter the full legal document text here..." required />
                </div>
              </div>
              <button type="submit" className="btn btn-success mt-3">Create Document + Generate PDF</button>
            </form>
          </div>
        </motion.div>
      )}

      {documents.length === 0 ? (
        <p className="text-muted">No documents yet.</p>
      ) : (
        <div className="row g-3">
          {documents.map((doc, i) => (
            <motion.div key={doc._id} className="col-md-6"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}>
              <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                <div className="card-body">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="badge bg-light text-dark">{doc.documentNumber}</span>
                    <span className={`badge bg-${STATUS_COLORS[doc.status]}`}>{doc.status}</span>
                  </div>
                  <h6 className="fw-bold">{doc.title}</h6>
                  <p className="text-muted small mb-1">
                    {doc.documentType.replace(/_/g, ' ')} · Case: {doc.case?.caseNumber}
                  </p>
                  <p className="text-muted small mb-2">
                    {isLawyer ? `Client: ${doc.client?.name}` : `By: ${doc.lawyer?.name}`}
                  </p>
                  <div className="d-flex gap-2">
                    {doc.pdfUrl && (doc.status !== 'revoked' || isLawyer) && (
                      <a href={`http://localhost:5000${doc.pdfUrl}`} target="_blank" rel="noreferrer"
                         className="btn btn-sm btn-outline-primary">Download PDF</a>
                    )}
                    {doc.status === 'issued' && isLawyer && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleRevoke(doc._id)}>
                        Revoke
                      </button>
                    )}
                    {doc.status === 'revoked' && !isLawyer && (
                      <span className="text-danger small">Access revoked by lawyer</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentHub;
