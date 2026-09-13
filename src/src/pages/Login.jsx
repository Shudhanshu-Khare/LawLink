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
    } finally { setLoading(false); }
  };

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
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', -apple-system, sans-serif;
          background: #eee9e2;
        }

        /* ── Dark green right background ── */
        .login-bg-green {
          position: absolute;
          right: 0;
          top: 0;
          width: 42%;
          height: 100%;
          background: #3d4f3e;
          clip-path: polygon(12% 0, 100% 0, 100% 100%, 0% 100%);
          z-index: 0;
        }

        /* ── Stone/marble texture top-right ── */
        .login-bg-marble {
          position: absolute;
          right: 0;
          top: 0;
          width: 18%;
          height: 48%;
          z-index: 1;
          background: linear-gradient(160deg,
            #b8b3ab 0%,
            #a09b93 20%,
            #b5afa7 35%,
            #8e8980 50%,
            #a8a39b 65%,
            #969189 80%,
            #b0aaa2 100%
          );
          opacity: 0.85;
        }

        /* ── Decorative circle ── */
        .login-circle {
          position: absolute;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          border: 1px solid rgba(190, 185, 175, 0.45);
          left: 42%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          pointer-events: none;
        }

        /* ── Scale image ── */
        .login-scale {
          position: absolute;
          left: -20px;
          top: 18%;
          width: 200px;
          height: auto;
          opacity: 0.18;
          z-index: 1;
          pointer-events: none;
          filter: contrast(1.5) brightness(0.2);
        }

        /* ── Left section ── */
        .login-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 40px 60px 72px;
          position: relative;
          z-index: 2;
          max-width: 580px;
        }

        .login-logo {
          font-family: 'DM Serif Display', serif;
          font-style: italic;
          font-size: 1.85rem;
          color: #1a1a1a;
          display: block;
          margin-bottom: 10px;
          letter-spacing: -0.3px;
        }

        .login-logo-line {
          width: 32px;
          height: 2.5px;
          background: #1a1a1a;
          margin-bottom: 72px;
        }

        .login-heading {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(2.6rem, 4vw, 3.8rem);
          line-height: 1.08;
          color: #111;
          margin: 0 0 24px 0;
          max-width: 400px;
          font-weight: 400;
          letter-spacing: -1.2px;
        }

        .login-subtitle {
          font-size: 0.92rem;
          color: #7a756e;
          line-height: 1.65;
          max-width: 370px;
          margin: 0;
          font-weight: 400;
        }

        /* ── Right section ── */
        .login-right {
          width: 460px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 48px 40px 20px;
          position: relative;
          z-index: 5;
        }

        /* ── Card ── */
        .login-card {
          background: rgba(255, 255, 255, 0.93);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 14px;
          padding: 40px 36px;
          width: 100%;
          max-width: 380px;
          box-shadow: 0 6px 36px rgba(0,0,0,0.07);
        }

        .login-card-title {
          font-family: 'DM Serif Display', serif;
          text-align: center;
          margin: 0 0 4px 0;
          font-size: 1.55rem;
          font-weight: 400;
          color: #1a1a1a;
          letter-spacing: -0.3px;
        }

        .login-card-sub {
          text-align: center;
          color: #9a958e;
          font-size: 0.82rem;
          margin: 0 0 24px 0;
        }

        /* Google button wrapper */
        .login-google-wrap {
          background: rgba(230, 226, 220, 0.45);
          border-radius: 24px;
          padding: 4px;
          margin-bottom: 16px;
          display: flex;
          justify-content: center;
        }

        /* Divider */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 16px 0;
          color: #c0bbb3;
          font-size: 0.78rem;
        }
        .login-divider span { flex-shrink: 0; }
        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #ddd8d0;
        }

        /* More options btn */
        .login-more-btn {
          width: 100%;
          padding: 12px 20px;
          background: #fff;
          border: 1px solid #ddd8d0;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 0.87rem;
          color: #1a1a1a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 500;
          transition: border-color 0.15s;
        }
        .login-more-btn:hover {
          border-color: #bbb6ae;
        }

        /* Watch demo btn */
        .login-demo-btn {
          width: 100%;
          margin-top: 16px;
          background: #3d4f3e;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          height: 48px;
          overflow: hidden;
          transition: background 0.15s;
        }
        .login-demo-btn:hover {
          background: #4a5e4b;
        }
        .login-demo-play {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .login-demo-play-circle {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-demo-divider {
          width: 1px;
          height: 22px;
          background: rgba(255,255,255,0.22);
        }
        .login-demo-text {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 0.85rem;
          font-weight: 500;
          padding-right: 12px;
        }

        /* Error alert */
        .login-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 9px 14px;
          border-radius: 8px;
          font-size: 0.78rem;
          margin-bottom: 14px;
          text-align: center;
        }

        /* Test login inputs */
        .login-test-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #ddd8d0;
          font-size: 0.84rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          background: #faf8f5;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .login-test-input:focus {
          border-color: #3d4f3e;
        }

        .login-test-submit {
          width: 100%;
          padding: 11px;
          background: #3d4f3e;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .login-test-submit:hover {
          background: #4a5e4b;
        }

        @media (max-width: 900px) {
          .login-page { flex-direction: column; }
          .login-bg-green { display: none; }
          .login-bg-marble { display: none; }
          .login-circle { display: none; }
          .login-scale { display: none; }
          .login-left { padding: 40px 24px 20px; max-width: 100%; }
          .login-right { width: 100%; padding: 20px 24px 40px; }
          .login-logo-line { margin-bottom: 32px; }
        }
      `}</style>

      <div className="login-page">
        <div className="login-bg-green" />
        <div className="login-bg-marble" />
        <div className="login-circle" />

        <img src="/assets/justice-scale.jpg" alt="" className="login-scale" />

        {/* ══════ LEFT SIDE ══════ */}
        <div className="login-left">
          <span className="login-logo">LawLink</span>
          <div className="login-logo-line" />

          <h1 className="login-heading">
            Your legal<br />work, in one<br />place.
          </h1>

          <p className="login-subtitle">
            A full-stack legal workflow platform with consultations, case tracking, real-time chat, document generation, invoicing and deadline management.
          </p>
        </div>

        {/* ══════ RIGHT SIDE ══════ */}
        <div className="login-right">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="login-card"
          >
            <h2 className="login-card-title">Welcome to LawLink</h2>
            <p className="login-card-sub">Sign in to continue</p>

            {error && <div className="login-error">{error}</div>}

            {/* Google Sign In */}
            <div className="login-google-wrap">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed')}
                text="continue_with"
                shape="pill"
                size="large"
                width="310"
              />
            </div>

            {/* Divider */}
            <div className="login-divider"><span>or</span></div>

            {/* More Options */}
            <button className="login-more-btn" onClick={() => setShowMore(!showMore)}>
              More options
              <i className={`bi bi-chevron-${showMore ? 'up' : 'down'}`} style={{ fontSize: '0.68rem' }} />
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
                    <button className="ll-dropdown-item" onClick={() => setShowTestLogin(!showTestLogin)}>
                      <div className="ll-dropdown-icon"><i className="bi bi-person" /></div>
                      <div className="ll-dropdown-text">
                        <h6>Log in with test account</h6>
                        <p>Explore the platform</p>
                      </div>
                    </button>
                    <Link to="/register" className="ll-dropdown-item" style={{ textDecoration: 'none' }}>
                      <div className="ll-dropdown-icon"><i className="bi bi-plus" /></div>
                      <div className="ll-dropdown-text">
                        <h6>Don't have an account?</h6>
                        <p>Register now</p>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Test Account Form */}
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
                      <input type="email" placeholder="Email" required className="login-test-input"
                        value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <input type="password" placeholder="Password" required className="login-test-input"
                        value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                    <button type="submit" disabled={loading} className="login-test-submit">
                      {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Watch Demo */}
            <button className="login-demo-btn" onClick={() => {/* Google Drive link TBD */}}>
              <div className="login-demo-play">
                <div className="login-demo-play-circle">
                  <span style={{ color: '#fff', fontSize: '0.6rem', marginLeft: '2px' }}>▶</span>
                </div>
              </div>
              <div className="login-demo-divider" />
              <div className="login-demo-text">
                <span>Watch demo</span>
                <span style={{ fontSize: '0.95rem' }}>→</span>
              </div>
            </button>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Login;
