// src/src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow-lg" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card-body p-4">
          <h3 className="fw-bold text-center mb-1">🔑 Forgot Password</h3>
          <p className="text-muted text-center mb-4">Enter your email to receive a reset link</p>

          {sent ? (
            <div className="text-center py-3">
              <div style={{ fontSize: 48 }}>📧</div>
              <h5 className="mt-3">Check Your Email</h5>
              <p className="text-muted">If that email is registered, we've sent a password reset link. Check your inbox (and spam folder).</p>
              <Link to="/login" className="btn btn-primary mt-2">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <div className="mb-3">
                <label className="form-label">Email address</label>
                <input type="email" className="form-control" required
                       value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="you@example.com" />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : 'Send Reset Link'}
              </button>
              <div className="text-center mt-3">
                <Link to="/login" className="text-decoration-none">← Back to Login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ForgotPassword;
