// src/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/authService';
import { motion } from 'framer-motion';
import api from '../services/api';

const Login = () => {
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Google login
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential
      });

      if (data.newUser) {
        navigate('/register', { state: { googleData: data.googleData } });
      } else {
        login(data.token, data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || (err.response?.status === 429 ? 'Too many requests. Please wait a minute and try again.' : err.code === 'ECONNABORTED' || !err.response ? 'Could not reach server. It may be waking up — please wait 30 seconds and try again.' : 'Google sign-in failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Email+password login (test accounts only)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(formData);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || (err.response?.status === 429 ? 'Too many requests. Please wait a minute and try again.' : err.code === 'ECONNABORTED' || !err.response ? 'Could not reach server. It may be waking up — please wait 30 seconds and try again.' : 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
         style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card shadow-lg border-0"
        style={{ width: '420px', borderRadius: '16px' }}
      >
        <div className="card-body p-4">
          <h2 className="text-center mb-1 fw-bold">Welcome to LawLink</h2>
          <p className="text-center text-muted mb-4">Sign in with your Google account</p>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          {/* Google Sign In — Primary */}
          <div className="d-flex justify-content-center mb-3">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in failed')}
              text="signin_with"
              shape="rectangular"
              width="350"
            />
          </div>

          <p className="text-center mt-3 mb-2">
            Don't have an account? <Link to="/register">Register</Link>
          </p>

          {/* Collapsible test account login */}
          <div className="text-center">
            <button className="btn btn-link btn-sm text-muted p-0"
                    style={{ fontSize: '12px', textDecoration: 'none' }}
                    onClick={() => setShowTestLogin(!showTestLogin)}>
              {showTestLogin ? '▲ Hide' : '▼ Test account login'}
            </button>
          </div>

          {showTestLogin && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 p-3 rounded" style={{ background: '#f8fafc' }}>
              <form onSubmit={handleSubmit}>
                <div className="mb-2">
                  <input type="email" name="email" className="form-control form-control-sm"
                         placeholder="Email" value={formData.email}
                         onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <input type="password" name="password" className="form-control form-control-sm"
                         placeholder="Password" value={formData.password}
                         onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-sm btn-outline-secondary w-100" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In (Test)'}
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
