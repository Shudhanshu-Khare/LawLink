// src/src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const GoogleGIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g clipPath="url(#register-google-g-clip)">
      <path fill="#4285F4" d="M8 6.99902V10.0972H12.3054C12.1164 11.0936 11.549 11.9372 10.6981 12.5045L13.2945 14.5191C14.8072 13.1227 15.68 11.0718 15.68 8.63547C15.68 8.0682 15.6291 7.5227 15.5345 6.99911L8 6.99902Z" />
      <path fill="#34A853" d="M3.51649 9.97632L2.93092 10.4246L0.858154 12.0391C2.17451 14.65 4.8725 16.4536 7.99974 16.4536C10.1597 16.4536 11.9706 15.7409 13.2942 14.5191L10.6979 12.5046C9.98516 12.9846 9.07606 13.2755 7.99974 13.2755C5.91976 13.2755 4.15254 11.8719 3.51976 9.98094L3.51649 9.97632Z" />
      <path fill="#FBBC05" d="M0.858119 4.86816C0.312695 5.94448 0 7.15905 0 8.45357C0 9.74809 0.312695 10.9627 0.858119 12.039C0.858119 12.0462 3.51998 9.97352 3.51998 9.97352C3.35998 9.49352 3.26541 8.98446 3.26541 8.45349C3.26541 7.92251 3.35998 7.41345 3.51998 6.93345L0.858119 4.86816Z" />
      <path fill="#EA4335" d="M7.99991 3.63907C9.17811 3.63907 10.2254 4.04633 11.0617 4.83179L13.3526 2.54091C11.9635 1.24639 10.1599 0.453613 7.99991 0.453613C4.87266 0.453613 2.17451 2.24997 0.858154 4.86816L3.51994 6.93362C4.15263 5.04269 5.91992 3.63907 7.99991 3.63907Z" />
    </g>
    <defs>
      <clipPath id="register-google-g-clip">
        <rect width="16" height="16" fill="white" transform="translate(0 0.453613)" />
      </clipPath>
    </defs>
  </svg>
);

const Register = () => {
  const location = useLocation();
  const [googleData, setGoogleData] = useState(location.state?.googleData || null);
  const [step, setStep] = useState(googleData ? 'profile' : 'choose');
  const [formData, setFormData] = useState({
    role: 'client',
    barRegistrationNumber: '',
    yearsOfExperience: '',
    feePerHour: '',
    practiceAreas: [],
    bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePracticeArea = (area) => {
    const current = formData.practiceAreas;
    if (current.includes(area)) {
      setFormData({ ...formData, practiceAreas: current.filter(a => a !== area) });
    } else {
      setFormData({ ...formData, practiceAreas: [...current, area] });
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        access_token: tokenResponse.access_token,
        mode: 'register'
      });
      setGoogleData(data.googleData);
      setStep('profile');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  const googleSignUp = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google sign-up failed'),
  });

  const handleGoogleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.role === 'lawyer') {
      if (!formData.barRegistrationNumber) return setError('Bar registration number is required');
      if (!formData.feePerHour || formData.feePerHour <= 0) return setError('Fee per hour is required');
      if (!formData.yearsOfExperience) return setError('Years of experience is required');
      if (formData.practiceAreas.length === 0) return setError('Select at least one practice area');
    }
    setLoading(true);
    try {
      const payload = {
        googleId: googleData.googleId,
        name: googleData.name,
        email: googleData.email,
        role: formData.role,
        barRegistrationNumber: formData.barRegistrationNumber,
        yearsOfExperience: formData.yearsOfExperience ? Number(formData.yearsOfExperience) : undefined,
        feePerHour: formData.feePerHour ? Number(formData.feePerHour) : undefined,
        practiceAreas: formData.practiceAreas,
        bio: formData.bio
      };
      const { data } = await api.post('/auth/google-register', payload);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const isLawyer = formData.role === 'lawyer';

  const lawyerFields = (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{ background: '#f5f3ee', padding: '16px', borderRadius: '12px', marginBottom: '14px', border: '1px solid #e5e1d8' }}>
        <h6 style={{ fontWeight: 600, marginBottom: '14px', color: '#1a1a1a', fontSize: '0.86rem' }}>Professional Details</h6>
        <div style={{ marginBottom: '10px' }}>
          <label className="register-label">Bar Registration Number</label>
          <input
            className="register-input"
            type="text"
            name="barRegistrationNumber"
            placeholder="e.g. BAR-DL-2020-001"
            value={formData.barRegistrationNumber}
            onChange={handleChange}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label className="register-label">Experience (Years)</label>
            <input
              className="register-input"
              type="number"
              name="yearsOfExperience"
              min="0"
              max="50"
              placeholder="e.g. 5"
              value={formData.yearsOfExperience}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="register-label">Fee (₹/hr)</label>
            <input
              className="register-input"
              type="number"
              name="feePerHour"
              min="100"
              step="100"
              placeholder="e.g. 2500"
              value={formData.feePerHour}
              onChange={handleChange}
            />
          </div>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label className="register-label">Practice Areas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {PRACTICE_AREAS.map(area => {
              const active = formData.practiceAreas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => togglePracticeArea(area)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 500,
                    border: active ? '1px solid #25382b' : '1px solid #d5d0c8',
                    background: active ? '#25382b' : '#fff',
                    color: active ? '#fff' : '#444',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {area.charAt(0).toUpperCase() + area.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="register-label">Short Bio</label>
          <textarea
            className="register-input"
            name="bio"
            rows={2}
            placeholder="Describe your legal expertise..."
            value={formData.bio}
            onChange={handleChange}
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <style>{`
        .register-page {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          position: relative;
          overflow-x: hidden;
          background: #f4f2ee url('/assets/login-bg.jpg') no-repeat center center / cover;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* ── LawLink Logo (Exact Position from Login Page, non-clickable) ── */
        .register-logo-wrap {
          position: absolute;
          top: clamp(75px, 12vh, 125px);
          left: clamp(48px, 6.8vw, 110px);
          z-index: 10;
          cursor: default;
          user-select: none;
          pointer-events: none;
        }

        .register-logo {
          font-family: 'Playfair Display', 'DM Serif Display', Georgia, serif;
          font-style: normal;
          font-size: 2.15rem;
          font-weight: 600;
          color: #141414;
          display: inline-block;
          letter-spacing: -0.4px;
          line-height: 1;
        }

        .register-logo-line {
          width: 34px;
          height: 2px;
          background: #141414;
          margin-top: 8px;
        }

        /* ── Main Centered Content Container with Equal Spacing ── */
        .register-main-container {
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
        .register-text-block {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }

        .register-heading {
          font-family: 'Playfair Display', 'DM Serif Display', Georgia, serif;
          font-size: clamp(2.8rem, 4.3vw, 4.2rem);
          line-height: 1.07;
          color: #111111;
          margin: 0 0 24px 0;
          font-weight: 600;
          letter-spacing: -1.2px;
        }

        .register-subtitle {
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 0.94rem;
          color: #68645e;
          line-height: 1.68;
          max-width: 415px;
          margin: 0;
          font-weight: 400;
        }

        /* ── Card Wrapper ── */
        .register-card-wrapper {
          width: 100%;
          max-width: 440px;
          display: flex;
          justify-content: center;
          box-sizing: border-box;
        }

        /* ── White Register Card ── */
        .register-card {
          background: #fbfaf7;
          border-radius: 18px;
          padding: 44px 38px 40px;
          width: 100%;
          min-width: 360px;
          max-width: 440px;
          box-shadow: 0 16px 44px -8px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02);
          box-sizing: border-box;
        }

        .register-card-title {
          font-family: 'Playfair Display', 'DM Serif Display', Georgia, serif;
          text-align: center;
          margin: 0 0 6px 0;
          font-size: 1.7rem;
          font-weight: 600;
          color: #141414;
          letter-spacing: -0.3px;
        }

        .register-card-sub {
          font-family: 'Inter', sans-serif;
          text-align: center;
          color: #7e7a73;
          font-size: 0.84rem;
          margin: 0 0 28px 0;
          font-weight: 400;
        }

        /* ── Custom Google Pill Button ── */
        .register-google-btn {
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
        .register-google-btn:hover {
          background: #dddce5;
        }
        .register-google-btn:active {
          transform: scale(0.99);
        }
        .register-google-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* ── Divider ── */
        .register-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
          color: #a8a49c;
          font-size: 0.8rem;
        }
        .register-divider span { flex-shrink: 0; }
        .register-divider::before,
        .register-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #dfdad2;
        }

        /* ── Input & Select ── */
        .register-label {
          display: block;
          font-size: 0.78rem;
          font-weight: 500;
          color: #555;
          margin-bottom: 5px;
        }

        .register-input {
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
        .register-input:focus {
          border-color: #25382b;
        }

        .register-select {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #ddd8d0;
          font-size: 0.84rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          background: #faf8f5;
          box-sizing: border-box;
          cursor: pointer;
        }
        .register-select:focus {
          border-color: #25382b;
        }

        .register-submit {
          width: 100%;
          padding: 12px;
          background: #25382b;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }
        .register-submit:hover {
          background: #2f4536;
        }
        .register-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* ── Error Banner ── */
        .register-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.8rem;
          margin-bottom: 16px;
          text-align: center;
        }

        @media (max-width: 992px) {
          .register-page {
            flex-direction: column;
            background-size: cover;
            background-position: top center;
          }
          .register-logo-wrap {
            position: static;
            padding: 40px 24px 0;
            margin-bottom: 20px;
          }
          .register-main-container {
            flex-direction: column;
            justify-content: flex-start;
            padding: 10px 24px 40px;
            min-height: auto;
            gap: 32px;
          }
          .register-text-block {
            max-width: 100%;
          }
          .register-card-wrapper {
            max-width: 100%;
          }
          .register-card {
            max-width: 100%;
            min-width: unset;
          }
        }

        @media (max-width: 576px) {
          .register-page {
            background-position: center;
          }
          .register-logo-wrap {
            padding: 36px 0 0;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .register-text-block {
            text-align: center;
            max-width: 100%;
            padding: 0 8px;
          }
          .register-text-block h1 {
            font-size: 1.5rem;
          }
          .register-text-block p {
            font-size: 0.82rem;
            line-height: 1.5;
          }
          .register-main-container {
            padding: 10px 16px 32px;
            justify-content: center;
            gap: 0;
          }
          .register-card {
            padding: 32px 24px 28px;
            border-radius: 14px;
          }
          .register-card-title {
            font-size: 1.4rem;
          }
          .register-card-sub {
            font-size: 0.78rem;
            margin-bottom: 20px;
          }
          .register-google-btn {
            min-height: 44px;
          }
          .register-input {
            min-height: 44px;
          }
          .register-submit-btn {
            min-height: 44px;
          }
        }
      `}</style>

      <div className="register-page">
        {/* ══════ LawLink Logo (Exact Position from Login Page) ══════ */}
        <div className="register-logo-wrap">
          <span className="register-logo">LawLink</span>
          <div className="register-logo-line" />
        </div>

        {/* ══════ Centered Content with Equal Spacing ══════ */}
        <div className="register-main-container">
          {/* Text Block */}
          <div className="register-text-block">
            <h1 className="register-heading">
              Join the legal<br />platform.
            </h1>

            <p className="register-subtitle">
              Create your account and start managing your legal work — consultations, cases, documents, and more.
            </p>
          </div>

          {/* Register Card */}
          <div className="register-card-wrapper">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="register-card"
            >
              {step === 'choose' && (
                <>
                  <h2 className="register-card-title">Create Account</h2>
                  <p className="register-card-sub">Sign up with Google to get started</p>

                  {error && <div className="register-error">{error}</div>}

                  {/* Google Sign Up — custom pill button matching login design */}
                  <button
                    type="button"
                    className="register-google-btn"
                    onClick={() => googleSignUp()}
                    disabled={loading}
                  >
                    <GoogleGIcon />
                    <span>{loading ? 'Connecting…' : 'Sign up with Google'}</span>
                  </button>

                  <div className="register-divider"><span>or</span></div>

                  <p style={{ textAlign: 'center', fontSize: '0.84rem', color: '#7e7a73', margin: '4px 0 0' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: '#25382b', fontWeight: 600, textDecoration: 'none' }}>
                      Sign in
                    </Link>
                  </p>
                </>
              )}

              {step === 'profile' && googleData && (
                <>
                  <h2 className="register-card-title">Complete Your Profile</h2>
                  <p className="register-card-sub">
                    Signed in as <strong style={{ color: '#141414' }}>{googleData.email}</strong>
                  </p>

                  {error && <div className="register-error">{error}</div>}

                  <form onSubmit={handleGoogleRegister}>
                    <div style={{ marginBottom: '12px' }}>
                      <label className="register-label">Name</label>
                      <input
                        className="register-input"
                        type="text"
                        value={googleData.name}
                        disabled
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                      />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label className="register-label">I am a</label>
                      <select
                        className="register-select"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                      >
                        <option value="client">Client — I need legal help</option>
                        <option value="lawyer">Lawyer — I provide legal services</option>
                      </select>
                    </div>

                    <AnimatePresence>{isLawyer && lawyerFields}</AnimatePresence>

                    <button
                      type="submit"
                      className="register-submit"
                      disabled={loading}
                    >
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
