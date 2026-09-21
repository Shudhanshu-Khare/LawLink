// src/src/pages/InvoiceManager.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const downloadInvPDF = async (invId, invoiceNumber) => {
  try {
    const { data } = await api.get(`/invoices/${invId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${invoiceNumber || invId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) { alert(err.response?.data?.message || 'Failed to download PDF'); }
};

const STATUS_MAP = { pending: 'll-status-pending', paid: 'll-status-active', overdue: 'll-status-danger' };

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
      try {
        const [invRes, caseRes] = await Promise.all([api.get('/invoices'), api.get('/cases')]);
        setInvoices(invRes.data.invoices);
        setCases(caseRes.data.cases);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const addLineItem = () => setForm(prev => ({ ...prev, lineItems: [...prev.lineItems, { description: '', hours: '', ratePerHour: '' }] }));
  const updateLineItem = (idx, field, value) => setForm(prev => { const items = [...prev.lineItems]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, lineItems: items }; });
  const removeLineItem = (idx) => setForm(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }));
  const handleCaseSelect = (caseId) => { const s = cases.find(c => c._id === caseId); setForm(prev => ({ ...prev, caseId, clientId: s?.client?._id || '' })); };
  const calcTotal = () => form.lineItems.reduce((sum, item) => sum + (parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/invoices', {
        caseId: form.caseId, clientId: form.clientId, dueDate: form.dueDate,
        lineItems: form.lineItems.map(item => ({ description: item.description, hours: parseFloat(item.hours), ratePerHour: parseFloat(item.ratePerHour) }))
      });
      setShowForm(false);
      const { data } = await api.get('/invoices');
      setInvoices(data.invoices);
    } catch (err) { alert(err.response?.data?.message || 'Failed to create invoice'); }
  };

  const handlePay = async (id) => {
    if (!window.confirm('Mark this invoice as paid?')) return;
    await api.put(`/invoices/${id}/pay`);
    const { data } = await api.get('/invoices');
    setInvoices(data.invoices);
  };

  if (loading) return <div className="ll-spinner"><div className="spinner-border" style={{ color: 'var(--accent)' }} /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)' }}>Invoices</h1>
        {isLawyer && (
          <button className="ll-btn ll-btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : <><i className="bi bi-plus" /> New Invoice</>}
          </button>
        )}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="ll-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>Create Invoice</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="ll-label">Case</label>
                <select className="ll-select" value={form.caseId} onChange={e => handleCaseSelect(e.target.value)} required>
                  <option value="">Select case...</option>
                  {cases.filter(c => c.status !== 'closed').map(c => <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="ll-label">Due Date</label>
                <input type="date" className="ll-input" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} required />
              </div>
            </div>

            <label className="ll-label">Time Entries</label>
            {form.lineItems.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input className="ll-input" placeholder="Task description" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} required />
                <input type="number" step="any" min="0.1" className="ll-input" placeholder="Hours" value={item.hours} onChange={e => updateLineItem(idx, 'hours', e.target.value)} required />
                <input type="number" className="ll-input" placeholder="₹/hr" value={item.ratePerHour} onChange={e => updateLineItem(idx, 'ratePerHour', e.target.value)} required />
                <strong style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>₹{((parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0)).toFixed(0)}</strong>
                {form.lineItems.length > 1 && <button type="button" className="ll-btn ll-btn-sm ll-btn-ghost" onClick={() => removeLineItem(idx)}>×</button>}
              </div>
            ))}
            <button type="button" className="ll-btn ll-btn-sm ll-btn-outline" onClick={addLineItem} style={{ marginBottom: '16px' }}>+ Add entry</button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h3>Total: <strong>₹{calcTotal().toFixed(0)}</strong></h3>
              <button type="submit" className="ll-btn ll-btn-primary">Generate Invoice + PDF</button>
            </div>
          </form>
        </motion.div>
      )}

      {invoices.length === 0 ? (
        <div className="ll-empty"><i className="bi bi-receipt" /><p>No invoices yet.</p></div>
      ) : (
        <div className="ll-grid-2">
          {invoices.map((inv, i) => (
            <motion.div key={inv._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="ll-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong>{inv.invoiceNumber}</strong>
                  <span className={`ll-status ${STATUS_MAP[inv.status] || ''}`}>{inv.status}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 4px' }}>Case: {inv.case?.caseNumber} — {inv.case?.title}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 4px' }}>{isLawyer ? `Client: ${inv.client?.name}` : `Lawyer: ${inv.lawyer?.name}`}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 12px' }}>Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 700 }}>₹{inv.totalAmount}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="ll-btn ll-btn-sm ll-btn-outline" onClick={() => downloadInvPDF(inv._id, inv.invoiceNumber)}>
                      <i className="bi bi-download" /> PDF
                    </button>
                    {isClient && inv.status !== 'paid' && (
                      <button className="ll-btn ll-btn-sm ll-btn-primary" onClick={() => handlePay(inv._id)}>Pay</button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default InvoiceManager;
