import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Local date string to avoid UTC timezone issues
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    return Array.from({ length: 16 }, (_, i) => {
      const d = new Date(yesterday);
      d.setDate(yesterday.getDate() + i);
      return d;
    });
  };

  const [dates] = useState(getDates);
  const todayStr = getLocalDateStr(new Date());

  useEffect(() => {
    const fetchLawyer = async () => {
      const { data } = await api.get('/users/lawyers');
      const found = data.lawyers.find(l => l._id === lawyerId);
      setLawyer(found);
    };
    fetchLawyer();
  }, [lawyerId]);

  useEffect(() => {
    const fetchAvailability = async () => {
      const startDate = getLocalDateStr(dates[0]);
      const endDate = getLocalDateStr(dates[dates.length - 1]);

      const { data } = await api.get(`/consultations/availability/${lawyerId}`, {
        params: { startDate, endDate }
      });
      setAvailability(data.availability);
    };
    if (lawyerId) fetchAvailability();
  }, [lawyerId, dates]);

  const handleBook = async () => {
    setLoading(true);
    try {
      await api.post('/consultations', {
        lawyerId,
        date: selectedDate,
        timeSlot: selectedSlot,
        reason
      });
      setShowConfirm(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      alert(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Book Consultation</h2>

      {lawyer && (
        <div className="card border-0 shadow-sm mb-4 p-3">
          <div className="d-flex align-items-center">
            <div className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                 style={{ width: 56, height: 56, backgroundColor: '#e2e8f0', fontSize: '20px', fontWeight: 'bold' }}>
              {lawyer.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h5 className="mb-0 fw-bold">{lawyer.name}</h5>
              <small className="text-muted">Rs.{lawyer.feePerHour || '—'}/hr · {lawyer.practiceAreas?.join(', ') || 'General Practice'}</small>
            </div>
          </div>
        </div>
      )}

      <h5 className="fw-bold mb-3">Select a Date</h5>
      <div className="d-flex gap-2 mb-4" style={{ overflowX: 'auto', paddingBottom: 8 }}>
        {dates.map(date => {
          const dateStr = getLocalDateStr(date);
          const isPast = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;
          const dayAvail = availability[dateStr];
          const availCount = dayAvail?.available?.length || 0;

          return (
            <div key={dateStr} style={{ minWidth: 80, flexShrink: 0 }}>
              <div
                className={`card text-center p-2 
                  ${isSelected ? 'border-primary bg-primary bg-opacity-10' : ''} 
                  ${isPast ? 'opacity-50' : ''}`}
                style={{
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  borderRadius: '10px',
                  backgroundColor: isPast ? '#f1f5f9' : undefined
                }}
                onClick={() => {
                  if (!isPast) {
                    setSelectedDate(dateStr);
                    setSelectedSlot(null);
                  }
                }}
              >
                <small className={isPast ? 'text-secondary' : 'text-muted'}>{DAYS[date.getDay()]}</small>
                <strong className={isPast ? 'text-secondary' : ''}>{date.getDate()}</strong>
                {isToday && <small className="text-primary" style={{ fontSize: 10 }}>TODAY</small>}
                <small className={isPast ? 'text-secondary' : availCount > 0 ? 'text-success' : 'text-danger'}>
                  {isPast ? 'Past' : `${availCount} slot${availCount !== 1 ? 's' : ''}`}
                </small>
              </div>
            </div>
          );
        })}
      </div>

      {selectedDate && availability[selectedDate] && (
        <div className="mb-4">
          <h5 className="fw-bold mb-3">Available Slots</h5>
          <div className="d-flex flex-wrap gap-2">
            {(availability[selectedDate].past || []).map(slot => (
              <button key={slot} className="btn btn-outline-secondary" disabled
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                {slot}
              </button>
            ))}
            {(availability[selectedDate].booked || []).map(slot => (
              <button key={slot} className="btn btn-outline-secondary" disabled
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                {slot}
              </button>
            ))}
            {availability[selectedDate].available.length === 0 && 
             (availability[selectedDate].past || []).length === 0 &&
             (availability[selectedDate].booked || []).length === 0 ? (
              <p className="text-muted">No slots for this date.</p>
            ) : (
              availability[selectedDate].available.map(slot => (
                <motion.button
                  key={slot}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot}
                </motion.button>
              ))
            )}
          </div>
        </div>
      )}

      {selectedSlot && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-3">
            <label className="form-label">Reason for consultation</label>
            <textarea className="form-control" rows={3} value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Briefly describe your legal matter..." />
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleBook} disabled={loading}>
            {loading ? 'Booking...' : `Book ${selectedSlot} on ${selectedDate}`}
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        className="card border-0 shadow-lg p-4 text-center" style={{ borderRadius: '16px' }}>
              <h3 className="text-success mb-2">Booked!</h3>
              <p>Your consultation has been scheduled. Redirecting...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookConsultation;
