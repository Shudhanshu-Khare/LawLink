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
      background: '#f0ece6',
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>

      {/* ── Dark green diagonal background shape (right side) ── */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: '45%',
        height: '100%',
        background: '#3a4a3c',
        clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)',
        zIndex: 0
      }} />

      {/* ── Marble texture overlay (top-right) ── */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: '22%',
        height: '55%',
        background: 'linear-gradient(145deg, #c5c0b8 0%, #9a9590 30%, #b5b0a8 60%, #8a8580 100%)',
        opacity: 0.7,
        zIndex: 1
      }} />

      {/* ── Large decorative circle (thin stroke) ── */}
      <div style={{
        position: 'absolute',
        width: '550px',
        height: '550px',
        borderRadius: '50%',
        border: '1px solid rgba(180, 175, 168, 0.5)',
        left: '35%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
        pointerEvents: 'none'
      }} />

      {/* ── Justice Scale Image (left side) ── */}
      <img
        src="/assets/justice-scale.jpg"
        alt=""
        style={{
          position: 'absolute',
          left: '-40px',
          top: '22%',
          width: '220px',
          height: 'auto',
          opacity: 0.15,
          zIndex: 1,
          pointerEvents: 'none',
          filter: 'contrast(1.2) brightness(0.3)'
        }}
      />

      {/* ══════════ LEFT: Branding ══════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 60px 60px 80px',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '80px' }}>
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontStyle: 'italic',
            fontSize: '2rem',
            color: '#1a1a1a',
            display: 'block',
            marginBottom: '12px',
            letterSpacing: '-0.5px'
          }}>LawLink</span>
          <div style={{
            width: '36px',
            height: '2.5px',
            background: '#1a1a1a'
          }} />
        </div>

        {/* Hero heading */}
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 'clamp(2.8rem, 4.5vw, 4rem)',
          lineHeight: 1.05,
          color: '#1a1a1a',
          marginBottom: '28px',
          maxWidth: '440px',
          fontWeight: 400,
          letterSpacing: '-1px'
        }}>
          Your legal<br />work, in one<br />place.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '0.95rem',
          color: '#6b6560',
          lineHeight: 1.7,
          maxWidth: '380px',
          fontWeight: 400
        }}>
          A full-stack legal workflow platform with consultations, case tracking, real-time chat, document generation, invoicing and deadline management.
        </p>
      </div>

      {/* ══════════ RIGHT: Login Card ══════════ */}
      <div style={{
        width: '500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        position: 'relative',
        zIndex: 5
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '16px',
            padding: '44px 40px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
            position: 'relative'
          }}
        >
          {/* Card heading */}
          <h2 style={{
            fontFamily: "'DM Serif Display', serif",
            textAlign: 'center',
            marginBottom: '4px',
            fontSize: '1.65rem',
            fontWeight: 400,
            color: '#1a1a1a',
            letterSpacing: '-0.5px'
          }}>Welcome to LawLink</h2>
          <p style={{
            textAlign: 'center',
            color: '#8a8580',
            fontSize: '0.85rem',
            marginBottom: '28px'
          }}>Sign in to continue</p>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              marginBottom: '16px',
              textAlign: 'center'
            }}>{error}</div>
          )}

          {/* Google Sign In — styled to match image */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              background: 'rgba(240, 236, 230, 0.6)',
              borderRadius: '28px',
              padding: '3px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed')}
                text="continue_with"
                shape="pill"
                size="large"
                width="320"
              />
            </div>
          </div>

          {/* Divider — "or" with lines */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            margin: '20px 0',
            color: '#b5b0a8',
            fontSize: '0.8rem'
          }}>
            <div style={{ flex: 1, height: '1px', background: '#ddd8d2' }} />
            <span>or</span>
            <div style={{ flex: 1, height: '1px', background: '#ddd8d2' }} />
          </div>

          {/* More Options button */}
          <button
            onClick={() => setShowMore(!showMore)}
            style={{
              width: '100%',
              padding: '13px 20px',
              background: '#ffffff',
              border: '1px solid #ddd8d2',
              borderRadius: '10px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.88rem',
              color: '#1a1a1a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              fontWeight: 500
            }}
          >
            More options
            <i className={`bi bi-chevron-${showMore ? 'up' : 'down'}`}
               style={{ fontSize: '0.7rem' }} />
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
                      style={{
                        width: '100%', padding: '11px 14px', borderRadius: '8px',
                        border: '1px solid #ddd8d2', fontSize: '0.85rem',
                        fontFamily: "'Inter', sans-serif", outline: 'none',
                        background: '#faf9f7', boxSizing: 'border-box'
                      }}
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="password" placeholder="Password" required
                      style={{
                        width: '100%', padding: '11px 14px', borderRadius: '8px',
                        border: '1px solid #ddd8d2', fontSize: '0.85rem',
                        fontFamily: "'Inter', sans-serif", outline: 'none',
                        background: '#faf9f7', boxSizing: 'border-box'
                      }}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <button type="submit" disabled={loading}
                    style={{
                      width: '100%', padding: '12px', background: '#3a4a3c',
                      color: '#fff', border: 'none', borderRadius: '8px',
                      fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Watch Demo Button — exact match to image */}
          <div style={{ marginTop: '20px' }}>
            <button
              style={{
                width: '100%',
                padding: '0',
                background: '#3a4a3c',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                height: '50px'
              }}
              onClick={() => {/* User will add Google Drive link later */}}
            >
              {/* Play circle icon */}
              <div style={{
                width: '50px',
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: '#fff', fontSize: '0.7rem', marginLeft: '2px' }}>▶</span>
                </div>
              </div>
              {/* Vertical divider */}
              <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.25)' }} />
              {/* Text */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.88rem',
                fontWeight: 500,
                paddingRight: '16px'
              }}>
                <span>Watch demo</span>
                <span style={{ fontSize: '1rem' }}>→</span>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
