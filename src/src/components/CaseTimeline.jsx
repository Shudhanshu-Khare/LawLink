// src/src/components/CaseTimeline.jsx
import { motion } from 'framer-motion';

const STAGES = [
  { key: 'intake', label: 'Intake', icon: 'bi-clipboard' },
  { key: 'investigation', label: 'Investigation', icon: 'bi-search' },
  { key: 'filing', label: 'Filing', icon: 'bi-folder' },
  { key: 'hearing', label: 'Hearing', icon: 'bi-building' },
  { key: 'resolution', label: 'Resolution', icon: 'bi-check-circle' },
  { key: 'closed', label: 'Closed', icon: 'bi-lock' }
];

const CaseTimeline = ({ currentStatus, milestones = [] }) => {
  const currentIdx = STAGES.findIndex(s => s.key === currentStatus);

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginBottom: '28px' }}>
        {/* Background track */}
        <div style={{ position: 'absolute', width: '100%', height: '3px', background: 'var(--border)', top: '50%', transform: 'translateY(-50%)' }} />
        {/* Filled track */}
        <motion.div
          style={{ position: 'absolute', height: '3px', background: 'var(--accent)', top: '50%', transform: 'translateY(-50%)', borderRadius: '2px', zIndex: 1 }}
          initial={{ width: '0%' }}
          animate={{ width: `${(currentIdx / (STAGES.length - 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Stage dots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 2 }}>
          {STAGES.map((stage, i) => {
            const isComplete = i <= currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <motion.div key={stage.key} style={{ textAlign: 'center' }}
                          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}>
                <div style={{
                  width: isCurrent ? 40 : 32, height: isCurrent ? 40 : 32,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 6px',
                  background: isComplete ? 'var(--accent)' : 'var(--bg-page)',
                  color: isComplete ? '#fff' : 'var(--text-muted)',
                  border: isCurrent ? '2px solid var(--accent-hover)' : `1px solid ${isComplete ? 'var(--accent)' : 'var(--border)'}`,
                  fontSize: isCurrent ? '0.9rem' : '0.75rem',
                  transition: 'all 0.3s ease'
                }}>
                  <i className={`bi ${stage.icon}`} />
                </div>
                <small style={{
                  fontSize: '0.65rem', display: 'block',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'
                }}>
                  {stage.label}
                </small>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Milestone log */}
      {milestones.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <label className="ll-label" style={{ marginBottom: '10px' }}>Timeline</label>
          {milestones.slice().reverse().map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{ display: 'flex', marginBottom: '8px', fontSize: '0.8rem' }}>
              <div style={{ color: 'var(--text-muted)', minWidth: '80px', fontSize: '0.75rem' }}>
                {new Date(m.timestamp).toLocaleDateString()}
              </div>
              <div>
                <span className="ll-badge" style={{ marginRight: '8px', fontSize: '0.65rem' }}>{m.stage}</span>
                <span>{m.note}</span>
                {m.addedBy && <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>— {m.addedBy.name}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaseTimeline;
