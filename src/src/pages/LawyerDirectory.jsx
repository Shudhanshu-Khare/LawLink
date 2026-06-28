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

      const { data } = await api.get('/users/lawyers', { params });
      setLawyers(data.lawyers);

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const slotCounts = {};
      await Promise.all(
        data.lawyers.map(async (lawyer) => {
          try {
            const { data: availData } = await api.get(`/consultations/availability/${lawyer._id}`, {
              params: { startDate: today, endDate: today }
            });
            slotCounts[lawyer._id] = availData.availability[today]?.available?.length || 0;
          } catch {
            slotCounts[lawyer._id] = 0;
          }
        })
      );
      setTodaySlots(slotCounts);
    } catch (err) {
      console.error('Failed to fetch lawyers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLawyers(); }, [filters]);

  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Find a Lawyer</h2>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="Search by name..."
                 value={filters.search}
                 onChange={e => setFilters({...filters, search: e.target.value})} />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={filters.practiceArea}
                  onChange={e => setFilters({...filters, practiceArea: e.target.value})}>
            <option value="">All Practice Areas</option>
            {PRACTICE_AREAS.map(area => (
              <option key={area} value={area}>{area.charAt(0).toUpperCase() + area.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="Filter by city..."
                 value={filters.city}
                 onChange={e => setFilters({...filters, city: e.target.value})} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : lawyers.length === 0 ? (
        <div className="text-center py-5 text-muted">No lawyers found matching your criteria.</div>
      ) : (
        <div className="row g-3">
          {lawyers.map((lawyer, i) => {
            const slotsToday = todaySlots[lawyer._id];
            return (
              <motion.div key={lawyer._id} className="col-md-6 col-lg-4"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>
                <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <div className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                           style={{ width: 48, height: 48, backgroundColor: '#e2e8f0', fontSize: '18px', fontWeight: 'bold' }}>
                        {lawyer.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold">{lawyer.name}</h6>
                        <small className="text-muted">
                          {lawyer.yearsOfExperience || 0} years exp.
                        </small>
                      </div>
                    </div>

                    {lawyer.practiceAreas?.length > 0 && (
                      <div className="mb-2">
                        {lawyer.practiceAreas.map(area => (
                          <span key={area} className="badge bg-light text-dark me-1 mb-1">
                            {area}
                          </span>
                        ))}
                      </div>
                    )}

                    {lawyer.bio && <p className="text-muted small mb-2">{lawyer.bio.substring(0, 100)}...</p>}

                    <div className="mb-2">
                      {slotsToday !== undefined && (
                        <span className={`badge ${slotsToday > 0 ? 'bg-success' : 'bg-secondary'} bg-opacity-10 
                              ${slotsToday > 0 ? 'text-success' : 'text-secondary'}`}
                              style={{ fontSize: 11 }}>
                          {slotsToday > 0 ? `${slotsToday} slot${slotsToday !== 1 ? 's' : ''} available today` : 'No slots today'}
                        </span>
                      )}
                    </div>

                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-success">Rs.{lawyer.feePerHour || '—'}/hr</span>
                      <Link to={`/book/${lawyer._id}`} className="btn btn-sm btn-outline-primary">
                        Book Consultation
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LawyerDirectory;
