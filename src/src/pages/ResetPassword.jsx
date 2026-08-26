// src/src/pages/ResetPassword.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      await api.put(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow-lg" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card-body p-4">
          <h3 className="fw-bold text-center mb-1">🔐 Reset Password</h3>
          <p className="text-muted text-center mb-4">Enter your new password</p>

          {success ? (
            <div className="text-center py-3">
              <div style={{ fontSize: 48 }}>✅</div>
              <h5 className="mt-3">Password Reset!</h5>
              <p className="text-muted">Redirecting to login page...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" required minLength={6}
                       value={password} onChange={e => setPassword(e.target.value)}
                       placeholder="Min. 6 characters" />
              </div>
              <div className="mb-3">
                <label className="form-label">Confirm Password</label>
                <input type="password" className="form-control" required
                       value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                       placeholder="Re-enter password" />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ResetPassword;
