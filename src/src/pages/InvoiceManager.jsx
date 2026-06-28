import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const InvoiceManager = () => {
  const { user, isLawyer, isClient } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    caseId: '', clientId: '', dueDate: '',
    lineItems: [{ description: '', hours: '', ratePerHour: '' }]
  });

  useEffect(() => {
    const load = async () => {
      const [invRes, caseRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/cases')
      ]);
      setInvoices(invRes.data.invoices);
      setCases(caseRes.data.cases);
      setLoading(false);
    };
    load();
  }, []);

  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: '', hours: '', ratePerHour: '' }]
    }));
  };

  const updateLineItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.lineItems];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, lineItems: items };
    });
  };

  const removeLineItem = (idx) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== idx)
    }));
  };

  const handleCaseSelect = (caseId) => {
    const selectedCase = cases.find(c => c._id === caseId);
    setForm(prev => ({
      ...prev,
      caseId,
      clientId: selectedCase?.client?._id || ''
    }));
  };

  const calcTotal = () => {
    return form.lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/invoices', {
        caseId: form.caseId,
        clientId: form.clientId,
        dueDate: form.dueDate,
        lineItems: form.lineItems.map(item => ({
          description: item.description,
          hours: parseFloat(item.hours),
          ratePerHour: parseFloat(item.ratePerHour)
        }))
      });
      setShowForm(false);
      const { data } = await api.get('/invoices');
      setInvoices(data.invoices);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create invoice');
    }
  };

  const handlePay = async (id) => {
    if (!window.confirm('Mark this invoice as paid?')) return;
    await api.put(`/invoices/${id}/pay`);
    const { data } = await api.get('/invoices');
    setInvoices(data.invoices);
  };

  const STATUS_COLORS = { pending: 'warning', paid: 'success', overdue: 'danger' };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">Invoices</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Invoice'}
          </button>
        )}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
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
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-control" value={form.dueDate}
                         onChange={e => setForm({...form, dueDate: e.target.value})} required />
                </div>
              </div>

              <h6 className="fw-bold mt-3 mb-2">Time Entries</h6>
              {form.lineItems.map((item, idx) => (
                <div key={idx} className="row g-2 mb-2 align-items-end">
                  <div className="col-md-5">
                    <input className="form-control" placeholder="Task description"
                           value={item.description}
                           onChange={e => updateLineItem(idx, 'description', e.target.value)} required />
                  </div>
                  <div className="col-md-2">
                    <input type="number" step="any" min="0.1" className="form-control" placeholder="Hours"
                           value={item.hours}
                           onChange={e => updateLineItem(idx, 'hours', e.target.value)} required />
                  </div>
                  <div className="col-md-2">
                    <input type="number" className="form-control" placeholder="₹/hr"
                           value={item.ratePerHour}
                           onChange={e => updateLineItem(idx, 'ratePerHour', e.target.value)} required />
                  </div>
                  <div className="col-md-2 text-end">
                    <strong>₹{((parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0)).toFixed(0)}</strong>
                  </div>
                  <div className="col-md-1">
                    {form.lineItems.length > 1 && (
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeLineItem(idx)}>×</button>
                    )}
                  </div>
                </div>
              ))}

              <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={addLineItem}>+ Add entry</button>

              <div className="d-flex justify-content-between align-items-center border-top pt-3">
                <h5 className="mb-0">Total: <strong>₹{calcTotal().toFixed(0)}</strong></h5>
                <button type="submit" className="btn btn-success">Generate Invoice + PDF</button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {invoices.length === 0 ? (
        <p className="text-muted">No invoices yet.</p>
      ) : (
        <div className="row g-3">
          {invoices.map((inv, i) => (
            <motion.div key={inv._id} className="col-md-6"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}>
              <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                <div className="card-body">
                  <div className="d-flex justify-content-between mb-2">
                    <strong>{inv.invoiceNumber}</strong>
                    <span className={`badge bg-${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                  </div>
                  <p className="small text-muted mb-1">Case: {inv.case?.caseNumber} — {inv.case?.title}</p>
                  <p className="small text-muted mb-1">
                    {isLawyer ? `Client: ${inv.client?.name}` : `Lawyer: ${inv.lawyer?.name}`}
                  </p>
                  <p className="small text-muted mb-2">Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">₹{inv.totalAmount}</h5>
                    <div className="d-flex gap-2">
                      <a href={`http://localhost:5000${inv.pdfUrl}`} target="_blank" rel="noreferrer"
                         className="btn btn-sm btn-outline-primary">PDF</a>
                      {isClient && inv.status !== 'paid' && (
                        <button className="btn btn-sm btn-success" onClick={() => handlePay(inv._id)}>Pay</button>
                      )}
                    </div>
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

export default InvoiceManager;
