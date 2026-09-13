// src/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/authService';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const Login = () => {
  const [showMore, setShowMore] = useState(false);
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
        credential: credentialResponse.credential,
        mode: 'login'
      });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message ||
        (err.response?.status === 429 ? 'Too many requests. Please wait a minute.' :
        err.code === 'ECONNABORTED' || !err.response ? 'Could not reach server — please wait 30s and try again.' :
        'Google sign-in failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Test account login
  const handleTestLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(formData);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message ||
        (err.code === 'ECONNABORTED' || !err.response ? 'Could not reach server.' : 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-page)',
      display: 'flex',
      alignItems: 'stretch'
    }}>
      {/* ── Left: Hero ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 60px 60px 80px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '60px' }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '1.75rem',
            color: 'var(--text-primary)',
            display: 'block',
            marginBottom: '8px'
          }}>LawLink</span>
          <div style={{
            width: '32px',
            height: '2px',
            background: 'var(--text-primary)'
          }} />
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '3.5rem',
          lineHeight: 1.1,
          color: 'var(--text-primary)',
          marginBottom: '24px',
          maxWidth: '420px'
        }}>
          Your legal<br />work, in one<br />place.
        </h1>

        {/* Description */}
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          maxWidth: '380px'
        }}>
          A full-stack legal workflow platform with consultations, case tracking, real-time chat, document generation, invoicing and deadline management.
        </p>

        {/* Decorative scale image — subtle */}
        <div style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.06,
          fontSize: '18rem',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          zIndex: 0
        }}>
          ⚖️
        </div>
      </div>

      {/* ── Right: Login Card ── */}
      <div style={{
        width: '480px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        position: 'relative'
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.5,
          pointerEvents: 'none'
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)',
            borderRadius: 'var(--radius-xl)',
            padding: '40px 36px',
            width: '100%',
            maxWidth: '380px',
            boxShadow: '0 4px 30px rgba(0,0,0,0.06)',
            position: 'relative',
            zIndex: 1
          }}
        >
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            textAlign: 'center',
            marginBottom: '4px',
            fontSize: '1.75rem'
          }}>Welcome to LawLink</h2>
          <p style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            marginBottom: '28px'
          }}>Sign in to continue</p>

          {error && (
            <div className="ll-alert ll-alert-error">{error}</div>
          )}

          {/* Google Sign In */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in failed')}
              text="continue_with"
              shape="rectangular"
              size="large"
              width="308"
            />
          </div>

          {/* Divider */}
          <div className="ll-divider">or</div>

          {/* More Options Toggle */}
          <button
            onClick={() => setShowMore(!showMore)}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            More options
            <i className={`bi bi-chevron-${showMore ? 'up' : 'down'}`}
               style={{ fontSize: '0.75rem' }} />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {showMore && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="ll-dropdown" style={{ marginTop: '8px' }}>
                  {/* Test account option */}
                  <button
                    className="ll-dropdown-item"
                    onClick={() => setShowTestLogin(!showTestLogin)}
                  >
                    <div className="ll-dropdown-icon">
                      <i className="bi bi-person" />
                    </div>
                    <div className="ll-dropdown-text">
                      <h6>Log in with test account</h6>
                      <p>Explore the platform</p>
                    </div>
                  </button>

                  {/* Register option */}
                  <Link to="/register" className="ll-dropdown-item" style={{ textDecoration: 'none' }}>
                    <div className="ll-dropdown-icon">
                      <i className="bi bi-plus" />
                    </div>
                    <div className="ll-dropdown-text">
                      <h6>Don't have an account?</h6>
                      <p>Register now</p>
                    </div>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Test Account Login Form */}
          <AnimatePresence>
            {showTestLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <form onSubmit={handleTestLogin} style={{ marginTop: '12px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <input
                      type="email" placeholder="Email" required
                      className="ll-input"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="password" placeholder="Password" required
                      className="ll-input"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="ll-btn ll-btn-primary" disabled={loading}
                          style={{ width: '100%', justifyContent: 'center' }}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Watch Demo */}
          <div style={{ marginTop: '20px' }}>
            <button className="ll-btn ll-btn-primary ll-btn-lg"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      background: 'var(--accent)',
                      borderRadius: 'var(--radius-sm)',
                      gap: '12px'
                    }}
                    onClick={() => window.open('https://lawlink-app.vercel.app/lawyers', '_blank')}
            >
              <i className="bi bi-play-circle-fill" style={{ fontSize: '1.25rem' }} />
              <span>Watch demo</span>
              <span style={{ marginLeft: 'auto' }}>→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
