// src/src/pages/BookConsultation.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const BookConsultation = () => {
  const { lawyerId } = useParams();
  const navigate = useNavigate();
  const [lawyer, setLawyer] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availability, setAvailability] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getDates = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    return Array.from({ length: 16 }, (_, i) => { const d = new Date(yesterday); d.setDate(yesterday.getDate() + i); return d; });
  };

  const [dates] = useState(getDates);
  const todayStr = getLocalDateStr(new Date());

  useEffect(() => {
    const fetchLawyer = async () => {
      try { const { data } = await api.get(`/users/public/${lawyerId}`); setLawyer(data.user); } catch {}
    };
    fetchLawyer();
  }, [lawyerId]);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const startDate = getLocalDateStr(dates[0]);
        const endDate = getLocalDateStr(dates[dates.length - 1]);
        const { data } = await api.get(`/consultations/availability/${lawyerId}`, { params: { startDate, endDate } });
        setAvailability(data.availability);
      } catch {}
    };
    if (lawyerId) fetchAvailability();
  }, [lawyerId, dates]);

  const handleBook = async () => {
    setLoading(true);
    try {
      await api.post('/consultations', { lawyerId, date: selectedDate, timeSlot: selectedSlot, reason });
      setShowConfirm(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) { alert(err.response?.data?.message || 'Booking failed'); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', marginBottom: '24px' }}>Book Consultation</h1>

      {/* Lawyer info card */}
      {lawyer && (
        <div className="ll-card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="ll-avatar" style={{ width: 52, height: 52, fontSize: '1.2rem' }}>
            {lawyer.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{lawyer.name}</div>
            <small style={{ color: 'var(--text-muted)' }}>
              ₹{lawyer.feePerHour || '—'}/hr · {lawyer.practiceAreas?.join(', ') || 'General Practice'}
            </small>
          </div>
        </div>
      )}

      {/* Date selector */}
      <h3 style={{ marginBottom: '16px' }}>Select a Date</h3>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '24px' }}>
        {dates.map(date => {
          const dateStr = getLocalDateStr(date);
          const isPast = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;
          const dayAvail = availability[dateStr];
          const availCount = dayAvail?.available?.length || 0;

          return (
            <div key={dateStr}
                 className="ll-card"
                 style={{
                   minWidth: 76, flexShrink: 0, textAlign: 'center', padding: '10px 8px',
                   cursor: isPast ? 'not-allowed' : 'pointer',
                   opacity: isPast ? 0.4 : 1,
                   borderColor: isSelected ? 'var(--accent)' : undefined,
                   background: isSelected ? 'var(--accent-light)' : isPast ? 'var(--bg-sidebar)' : undefined
                 }}
                 onClick={() => { if (!isPast) { setSelectedDate(dateStr); setSelectedSlot(null); } }}>
              <small style={{ color: 'var(--text-muted)', display: 'block' }}>{DAYS[date.getDay()]}</small>
              <strong style={{ display: 'block', fontSize: '1.1rem' }}>{date.getDate()}</strong>
              {isToday && <small style={{ color: 'var(--accent)', fontSize: '0.65rem', fontWeight: 700 }}>TODAY</small>}
              <small style={{ display: 'block', color: isPast ? 'var(--text-muted)' : availCount > 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.7rem' }}>
                {isPast ? 'Past' : `${availCount} slot${availCount !== 1 ? 's' : ''}`}
              </small>
            </div>
          );
        })}
      </div>

      {/* Time slots */}
      {selectedDate && availability[selectedDate] && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '14px' }}>Available Slots</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(availability[selectedDate].past || []).map(slot => (
              <button key={slot} className="ll-btn ll-btn-sm ll-btn-outline" disabled style={{ opacity: 0.3, cursor: 'not-allowed' }}>{slot}</button>
            ))}
            {(availability[selectedDate].booked || []).map(slot => (
              <button key={slot} className="ll-btn ll-btn-sm ll-btn-outline" disabled style={{ opacity: 0.3, cursor: 'not-allowed' }}>{slot}</button>
            ))}
            {availability[selectedDate].available.length === 0 &&
             (availability[selectedDate].past || []).length === 0 &&
             (availability[selectedDate].booked || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No slots for this date.</p>
            ) : (
              availability[selectedDate].available.map(slot => (
                <motion.button key={slot} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                               className={`ll-btn ll-btn-sm ${selectedSlot === slot ? 'll-btn-primary' : 'll-btn-outline'}`}
                               onClick={() => setSelectedSlot(slot)}>
                  {slot}
                </motion.button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Booking form */}
      {selectedSlot && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ marginBottom: '16px' }}>
            <label className="ll-label">Reason for consultation</label>
            <textarea className="ll-input" rows={3} value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="Briefly describe your legal matter..." style={{ resize: 'vertical' }} />
          </div>
          <button className="ll-btn ll-btn-primary ll-btn-lg" onClick={handleBook} disabled={loading}>
            {loading ? 'Booking...' : `Book ${selectedSlot} on ${selectedDate}`}
          </button>
        </motion.div>
      )}

      {/* Success modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ll-overlay">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="ll-modal" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✓</div>
              <h2 style={{ color: 'var(--success)', marginBottom: '8px' }}>Booked!</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Your consultation has been scheduled. Redirecting...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BookConsultation;
