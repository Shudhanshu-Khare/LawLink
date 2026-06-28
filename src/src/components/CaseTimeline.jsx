import { motion } from 'framer-motion';

const STAGES = [
  { key: 'intake', label: 'Intake', icon: '📋' },
  { key: 'investigation', label: 'Investigation', icon: '🔍' },
  { key: 'filing', label: 'Filing', icon: '📁' },
  { key: 'hearing', label: 'Hearing', icon: '⚖️' },
  { key: 'resolution', label: 'Resolution', icon: '✅' },
  { key: 'closed', label: 'Closed', icon: '🔒' }
];

const CaseTimeline = ({ currentStatus, milestones = [] }) => {
  const currentIdx = STAGES.findIndex(s => s.key === currentStatus);

  return (
    <div className="py-3">
      <div className="d-flex align-items-center mb-4 position-relative">
        <div className="position-absolute w-100" style={{ height: 4, background: '#e9ecef', top: '50%', transform: 'translateY(-50%)', zIndex: 0 }} />
        <motion.div
          className="position-absolute"
          style={{ height: 4, background: 'linear-gradient(90deg, #10b981, #059669)', top: '50%', transform: 'translateY(-50%)', zIndex: 1, borderRadius: 4 }}
          initial={{ width: '0%' }}
          animate={{ width: `${(currentIdx / (STAGES.length - 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        <div className="d-flex justify-content-between w-100 position-relative" style={{ zIndex: 2 }}>
          {STAGES.map((stage, i) => {
            const isComplete = i <= currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <motion.div
                key={stage.key}
                className="text-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-1"
                  style={{
                    width: isCurrent ? 44 : 36,
                    height: isCurrent ? 44 : 36,
                    background: isComplete ? '#10b981' : '#e9ecef',
                    color: isComplete ? 'white' : '#adb5bd',
                    fontSize: isCurrent ? 20 : 16,
                    border: isCurrent ? '3px solid #059669' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {stage.icon}
                </div>
                <small className={`d-block ${isCurrent ? 'fw-bold text-dark' : 'text-muted'}`}
                       style={{ fontSize: 11 }}>
                  {stage.label}
                </small>
              </motion.div>
            );
          })}
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="mt-3">
          <h6 className="fw-bold mb-2" style={{ fontSize: 13 }}>Timeline</h6>
          {milestones.slice().reverse().map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="d-flex mb-2"
            >
              <div className="me-3 text-muted" style={{ fontSize: 11, minWidth: 80 }}>
                {new Date(m.timestamp).toLocaleDateString()}
              </div>
              <div>
                <span className="badge bg-light text-dark me-2" style={{ fontSize: 10 }}>{m.stage}</span>
                <span className="small">{m.note}</span>
                {m.addedBy && <span className="text-muted small ms-1">— {m.addedBy.name}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaseTimeline;
