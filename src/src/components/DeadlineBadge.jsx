import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const DeadlineBadge = () => {
  const location = useLocation();
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    if (location.pathname === '/deadlines') return;

    const load = async () => {
      try {
        const { data } = await api.get('/deadlines', { params: { upcoming: 'true' } });
        const now = new Date();
        const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const urgent = data.deadlines.filter(d => new Date(d.deadlineDate) <= in48h);
        setUpcoming(urgent);
      } catch {
      }
    };
    load();
  }, [location.pathname]);

  if (upcoming.length === 0) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="d-inline-flex align-items-center px-2 py-1 rounded-pill"
      style={{
        background: upcoming.length > 2 ? '#fee2e2' : '#fef3c7',
        color: upcoming.length > 2 ? '#dc2626' : '#d97706',
        fontSize: 12,
        fontWeight: 600
      }}
    >
      {upcoming.length} deadline{upcoming.length > 1 ? 's' : ''} soon
    </motion.div>
  );
};

export default DeadlineBadge;
