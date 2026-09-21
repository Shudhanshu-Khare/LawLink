// src/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/authService';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const GoogleGIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g clipPath="url(#login-google-g-clip)">
      <path fill="#4285F4" d="M8 6.99902V10.0972H12.3054C12.1164 11.0936 11.549 11.9372 10.6981 12.5045L13.2945 14.5191C14.8072 13.1227 15.68 11.0718 15.68 8.63547C15.68 8.0682 15.6291 7.5227 15.5345 6.99911L8 6.99902Z" />
      <path fill="#34A853" d="M3.51649 9.97632L2.93092 10.4246L0.858154 12.0391C2.17451 14.65 4.8725 16.4536 7.99974 16.4536C10.1597 16.4536 11.9706 15.7409 13.2942 14.5191L10.6979 12.5046C9.98516 12.9846 9.07606 13.2755 7.99974 13.2755C5.91976 13.2755 4.15254 11.8719 3.51976 9.98094L3.51649 9.97632Z" />
      <path fill="#FBBC05" d="M0.858119 4.86816C0.312695 5.94448 0 7.15905 0 8.45357C0 9.74809 0.312695 10.9627 0.858119 12.039C0.858119 12.0462 3.51998 9.97352 3.51998 9.97352C3.35998 9.49352 3.26541 8.98446 3.26541 8.45349C3.26541 7.92251 3.35998 7.41345 3.51998 6.93345L0.858119 4.86816Z" />
      <path fill="#EA4335" d="M7.99991 3.63907C9.17811 3.63907 10.2254 4.04633 11.0617 4.83179L13.3526 2.54091C11.9635 1.24639 10.1599 0.453613 7.99991 0.453613C4.87266 0.453613 2.17451 2.24997 0.858154 4.86816L3.51994 6.93362C4.15263 5.04269 5.91992 3.63907 7.99991 3.63907Z" />
    </g>
    <defs>
      <clipPath id="login-google-g-clip">
        <rect width="16" height="16" fill="white" transform="translate(0 0.453613)" />
      </clipPath>
    </defs>
  </svg>
);

const Login = () => {
  const [showMore, setShowMore] = useState(false);
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (tokenResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        access_token: tokenResponse.access_token,
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

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google sign-in failed'),
  });

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
          width: 100vw;
          display: flex;
          position: relative;
          overflow-x: hidden;
          background: #f4f2ee url('/assets/login-bg.jpg') no-repeat center center / cover;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* ── LawLink Logo (non-clickable) ── */
        .login-logo-wrap {
          position: absolute;
          top: clamp(75px, 12vh, 125px);
          left: clamp(48px, 6.8vw, 110px);
          z-index: 10;
          cursor: default;
          user-select: none;
          pointer-events: none;
        }

        .login-logo {
          font-family: 'Playfair Display', 'DM Serif Display', Georgia, serif;
          font-style: normal;
          font-size: 2.15rem;
          font-weight: 600;
          color: #141414;
          display: inline-block;
          letter-spacing: -0.4px;
          line-height: 1;
        }

        .login-logo-line {
          width: 34px;
          height: 2px;
          background: #141414;
          margin-top: 8px;
        }

        /* ── Main Centered Content Container with Equal Spacing ── */
        .login-main-container {
          width: 100%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          position: relative;
          z-index: 2;
          box-sizing: border-box;
          padding: 60px 40px;
        }

        /* ── Text Block ── */
        .login-text-block {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }

        .login-heading {
          font-family: 'Playfair Display', 'DM Serif Display', Georgia, serif;
          font-size: clamp(2.8rem, 4.3vw, 4.2rem);
          line-height: 1.07;
          color: #111111;
          margin: 0 0 24px 0;
          font-weight: 600;
          letter-spacing: -1.2px;
        }

        .login-subtitle {
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 0.94rem;
          color: #68645e;
          line-height: 1.68;
          max-width: 415px;
          margin: 0;
          font-weight: 400;
        }

        /* ── Card Wrapper ── */
        .login-card-wrapper {
          width: 100%;
          max-width: 415px;
          display: flex;
          justify-content: center;
          box-sizing: border-box;
        }

        /* ── White Login Card ── */
        .login-card {
          background: #fbfaf7;
          border-radius: 18px;
          padding: 44px 38px 40px;
          width: 100%;
          min-width: 360px;
          max-width: 415px;
          max-height: min(580px, 80vh);
          overflow-y: auto;
          box-shadow: 0 16px 44px -8px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02);
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.12) transparent;
        }
        .login-card::-webkit-scrollbar { width: 4px; }
        .login-card::-webkit-scrollbar-track { background: transparent; }
        .login-card::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

        .login-card-title {
          font-family: 'Playfair Display', 'DM Serif Display', Georgia, serif;
          text-align: center;
          margin: 0 0 6px 0;
          font-size: 1.7rem;
          font-weight: 600;
          color: #141414;
          letter-spacing: -0.3px;
        }

        .login-card-sub {
          font-family: 'Inter', sans-serif;
          text-align: center;
          color: #7e7a73;
          font-size: 0.84rem;
          margin: 0 0 28px 0;
          font-weight: 400;
        }

        /* ── Custom Google Pill Button ── */
        .login-google-btn {
          width: 100%;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #e8e7ee;
          border: none;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 0.88rem;
          font-weight: 500;
          color: #242424;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          box-sizing: border-box;
        }
        .login-google-btn:hover {
          background: #dddce5;
        }
        .login-google-btn:active {
          transform: scale(0.99);
        }
        .login-google-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* ── Divider ── */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
          color: #a8a49c;
          font-size: 0.8rem;
        }
        .login-divider span { flex-shrink: 0; }
        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #dfdad2;
        }

        /* ── More Options Button ── */
        .login-more-btn {
          width: 100%;
          height: 44px;
          background: #faf9f6;
          border: 1px solid #dedad2;
          border-radius: 10px;
          font-family: 'Playfair Display', 'DM Serif Display', 'Inter', serif;
          font-size: 0.92rem;
          color: #242424;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          font-weight: 500;
          transition: border-color 0.15s ease, background 0.15s ease;
          box-sizing: border-box;
        }
        .login-more-btn:hover {
          border-color: #beb9af;
          background: #f4f3ef;
        }
        .login-more-chevron {
          position: absolute;
          right: 18px;
          font-size: 0.75rem;
          color: #4a4a4a;
          transition: transform 0.2s ease;
        }

        /* ── Watch Demo Button ── */
        .login-demo-btn {
          width: 100%;
          margin-top: 18px;
          background: #25382b;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          height: 48px;
          overflow: hidden;
          transition: background 0.15s ease;
          box-sizing: border-box;
        }
        .login-demo-btn:hover {
          background: #2f4536;
        }
        .login-demo-play {
          width: 50px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .login-demo-play-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-demo-triangle {
          width: 0;
          height: 0;
          border-top: 4px solid transparent;
          border-bottom: 4px solid transparent;
          border-left: 6.5px solid #ffffff;
          margin-left: 2px;
        }
        .login-demo-divider {
          width: 1px;
          height: 22px;
          background: rgba(255, 255, 255, 0.22);
        }
        .login-demo-text {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #ffffff;
          font-family: 'Inter', sans-serif;
          font-size: 0.88rem;
          font-weight: 500;
          padding-right: 14px;
        }

        /* ── Error Banner ── */
        .login-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.8rem;
          margin-bottom: 16px;
          text-align: center;
        }

        /* ── Dropdown Item Styles ── */
        .ll-dropdown {
          background: #fff;
          border: 1px solid #e5e1d8;
          border-radius: 10px;
          overflow: hidden;
          margin-top: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .ll-dropdown-item {
          width: 100%;
          padding: 11px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s;
        }
        .ll-dropdown-item:hover {
          background: #f7f6f2;
        }
        .ll-dropdown-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f0ede6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          flex-shrink: 0;
        }
        .ll-dropdown-text h6 {
          margin: 0;
          font-size: 0.84rem;
          font-weight: 600;
          color: #1a1a1a;
        }
        .ll-dropdown-text p {
          margin: 0;
          font-size: 0.74rem;
          color: #777;
        }

        /* ── Test Login Inputs ── */
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
          border-color: #25382b;
        }
        .login-test-submit {
          width: 100%;
          padding: 11px;
          background: #25382b;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }
        .login-test-submit:hover {
          background: #2f4536;
        }

        @media (max-width: 992px) {
          .login-page {
            flex-direction: column;
            background-size: cover;
            background-position: top center;
          }
          .login-logo-wrap {
            position: static;
            padding: 40px 24px 0;
            margin-bottom: 20px;
          }
          .login-main-container {
            flex-direction: column;
            justify-content: flex-start;
            padding: 10px 24px 40px;
            min-height: auto;
            gap: 32px;
          }
          .login-text-block {
            max-width: 100%;
          }
          .login-card-wrapper {
            max-width: 100%;
          }
          .login-card {
            max-width: 100%;
            min-width: unset;
          }
        }
      `}</style>

      <div className="login-page">
        {/* ══════ LawLink Logo (Exact Position Kept) ══════ */}
        <div className="login-logo-wrap">
          <span className="login-logo">LawLink</span>
          <div className="login-logo-line" />
        </div>

        {/* ══════ Centered Content with Equal Spacing ══════ */}
        <div className="login-main-container">
          {/* Text Block */}
          <div className="login-text-block">
            <h1 className="login-heading">
              Your legal<br />work, in one<br />place.
            </h1>

            <p className="login-subtitle">
              A full-stack legal workflow platform with consultations, case tracking, real-time chat, document generation, invoicing and deadline management.
            </p>
          </div>

          {/* Login Card */}
          <div className="login-card-wrapper">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="login-card"
            >
              <h2 className="login-card-title">Welcome to LawLink</h2>
              <p className="login-card-sub">Sign in to continue</p>

              {error && <div className="login-error">{error}</div>}

              {/* Google Sign In — custom pill button matching reference */}
              <button
                type="button"
                className="login-google-btn"
                onClick={() => googleLogin()}
                disabled={loading}
              >
                <GoogleGIcon />
                <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
              </button>

              {/* Divider */}
              <div className="login-divider"><span>or</span></div>

              {/* More Options */}
              <button
                type="button"
                className="login-more-btn"
                onClick={() => {
                  const next = !showMore;
                  setShowMore(next);
                  if (!next) setShowTestLogin(false);
                }}
              >
                <span>More options</span>
                <span
                  className="login-more-chevron"
                  style={{ transform: showMore ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▼
                </span>
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
                    <div className="ll-dropdown">
                      <button
                        type="button"
                        className="ll-dropdown-item"
                        onClick={() => setShowTestLogin(!showTestLogin)}
                      >
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
                    <form onSubmit={handleTestLogin} style={{ marginTop: '14px' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <input
                          type="email"
                          placeholder="Email (e.g. rahul@example.com)"
                          required
                          className="login-test-input"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <input
                          type="password"
                          placeholder="Password"
                          required
                          className="login-test-input"
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                      </div>
                      <button type="submit" disabled={loading} className="login-test-submit">
                        {loading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Watch Demo Button — per user request, link will be attached later */}
              <button
                type="button"
                className="login-demo-btn"
                onClick={() => {
                  /* User will attach Google Drive link later */
                }}
              >
                <div className="login-demo-play">
                  <div className="login-demo-play-circle">
                    <div className="login-demo-triangle" />
                  </div>
                </div>
                <div className="login-demo-divider" />
                <div className="login-demo-text">
                  <span>Watch demo</span>
                  <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>→</span>
                </div>
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
