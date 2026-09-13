// src/src/pages/LawyerDirectory.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const LawyerDirectory = () => {
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ practiceArea: '', city: '', search: '' });
  const [todaySlots, setTodaySlots] = useState({});

  const fetchLawyers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.practiceArea) params.practiceArea = filters.practiceArea;
      if (filters.city) params.city = filters.city;
      if (filters.search) params.search = filters.search;
      const [lawyersRes, availRes] = await Promise.all([
        api.get('/users/lawyers', { params }),
        api.get('/consultations/bulk-availability')
      ]);
      setLawyers(lawyersRes.data.lawyers);
      setTodaySlots(availRes.data.availability || {});
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchLawyers(); }, [filters]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', marginBottom: '24px' }}>Find a Lawyer</h1>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <input className="ll-input" type="text" placeholder="Search by name..."
               value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
        <select className="ll-select" value={filters.practiceArea}
                onChange={e => setFilters({ ...filters, practiceArea: e.target.value })}>
          <option value="">All Practice Areas</option>
          {PRACTICE_AREAS.map(area => <option key={area} value={area}>{area.charAt(0).toUpperCase() + area.slice(1)}</option>)}
        </select>
        <input className="ll-input" type="text" placeholder="Filter by city..."
               value={filters.city} onChange={e => setFilters({ ...filters, city: e.target.value })} />
      </div>

      {loading ? <div className="ll-spinner"><div className="spinner-border" style={{ color: 'var(--accent)' }} /></div> :
       lawyers.length === 0 ? (
        <div className="ll-empty"><i className="bi bi-search" /><p>No lawyers found matching your criteria.</p></div>
       ) : (
        <div className="ll-grid">
          {lawyers.map((lawyer, i) => {
            const slotsToday = todaySlots[lawyer._id];
            return (
              <motion.div key={lawyer._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>
                <div className="ll-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div className="ll-avatar" style={{ width: 44, height: 44, fontSize: '1rem' }}>
                      {lawyer.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{lawyer.name}</div>
                      <small style={{ color: 'var(--text-muted)' }}>{lawyer.yearsOfExperience || 0} years exp.</small>
                    </div>
                  </div>

                  {lawyer.practiceAreas?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {lawyer.practiceAreas.map(area => (
                        <span key={area} className="ll-badge">{area}</span>
                      ))}
                    </div>
                  )}

                  {lawyer.bio && <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '10px' }}>{lawyer.bio.substring(0, 100)}...</p>}

                  {slotsToday !== undefined && (
                    <div style={{ marginBottom: '12px' }}>
                      <span className={`ll-status ${slotsToday > 0 ? 'll-status-active' : 'll-status-closed'}`}>
                        {slotsToday > 0 ? `${slotsToday} slot${slotsToday !== 1 ? 's' : ''} today` : 'No slots today'}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{lawyer.feePerHour || '—'}/hr</span>
                    <Link to={`/book/${lawyer._id}`} className="ll-btn ll-btn-sm ll-btn-primary" style={{ textDecoration: 'none' }}>
                      Book Consultation
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default LawyerDirectory;
