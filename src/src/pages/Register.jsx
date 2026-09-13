// src/src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const Register = () => {
  const location = useLocation();
  const [googleData, setGoogleData] = useState(location.state?.googleData || null);
  const [step, setStep] = useState(googleData ? 'profile' : 'choose');
  const [formData, setFormData] = useState({
    role: 'client',
    barRegistrationNumber: '', yearsOfExperience: '', feePerHour: '', practiceAreas: [], bio: ''
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential,
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
        googleId: googleData.googleId, name: googleData.name, email: googleData.email,
        role: formData.role,
        barRegistrationNumber: formData.barRegistrationNumber,
        yearsOfExperience: formData.yearsOfExperience ? Number(formData.yearsOfExperience) : undefined,
        feePerHour: formData.feePerHour ? Number(formData.feePerHour) : undefined,
        practiceAreas: formData.practiceAreas, bio: formData.bio
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
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
      <div style={{ background: 'var(--accent-light)', padding: '20px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
        <h6 style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Professional Details</h6>
        <div style={{ marginBottom: '12px' }}>
          <label className="ll-label">Bar Registration Number</label>
          <input className="ll-input" type="text" name="barRegistrationNumber"
                 placeholder="e.g. BAR-DL-2020-001"
                 value={formData.barRegistrationNumber} onChange={handleChange} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label className="ll-label">Years of Experience</label>
            <input className="ll-input" type="number" name="yearsOfExperience"
                   min="0" max="50" placeholder="e.g. 5"
                   value={formData.yearsOfExperience} onChange={handleChange} />
          </div>
          <div>
            <label className="ll-label">Fee (₹/hr)</label>
            <input className="ll-input" type="number" name="feePerHour"
                   min="100" step="100" placeholder="e.g. 2500"
                   value={formData.feePerHour} onChange={handleChange} />
          </div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label className="ll-label">Practice Areas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {PRACTICE_AREAS.map(area => (
              <button key={area} type="button"
                      className={`ll-btn ll-btn-sm ${formData.practiceAreas.includes(area) ? 'll-btn-primary' : 'll-btn-outline'}`}
                      onClick={() => togglePracticeArea(area)}>
                {area.charAt(0).toUpperCase() + area.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="ll-label">Short Bio</label>
          <textarea className="ll-input" name="bio" rows={2}
                    placeholder="Describe your expertise..."
                    value={formData.bio} onChange={handleChange}
                    style={{ resize: 'vertical' }} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'stretch' }}>
      {/* Left Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 60px 60px 80px' }}>
        <div style={{ marginBottom: '60px' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.75rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>LawLink</span>
          <div style={{ width: '32px', height: '2px', background: 'var(--text-primary)' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3.5rem', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: '24px', maxWidth: '420px' }}>
          Join the legal<br />platform.
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '380px' }}>
          Create your account and start managing your legal work — consultations, cases, documents, and more.
        </p>
      </div>

      {/* Right Card */}
      <div style={{ width: '520px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
            borderRadius: 'var(--radius-xl)', padding: '36px 32px', width: '100%',
            maxWidth: '440px', boxShadow: '0 4px 30px rgba(0,0,0,0.06)'
          }}>

          {step === 'choose' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-serif)', textAlign: 'center', marginBottom: '4px' }}>Create Account</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '28px' }}>Sign up with Google to get started</p>
              {error && <div className="ll-alert ll-alert-error">{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-up failed')}
                  text="signup_with" shape="rectangular" size="large" width="376" />
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
              </p>
            </>
          )}

          {step === 'profile' && googleData && (
            <>
              <h2 style={{ fontFamily: 'var(--font-serif)', textAlign: 'center', marginBottom: '4px' }}>Complete Your Profile</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Signed in as <strong>{googleData.email}</strong>
              </p>
              {error && <div className="ll-alert ll-alert-error">{error}</div>}
              <form onSubmit={handleGoogleRegister}>
                <div style={{ marginBottom: '12px' }}>
                  <label className="ll-label">Name</label>
                  <input className="ll-input" type="text" value={googleData.name} disabled style={{ opacity: 0.6 }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="ll-label">I am a</label>
                  <select className="ll-select" name="role" value={formData.role} onChange={handleChange}>
                    <option value="client">Client — I need legal help</option>
                    <option value="lawyer">Lawyer — I provide legal services</option>
                  </select>
                </div>
                <AnimatePresence>{isLawyer && lawyerFields}</AnimatePresence>
                <button type="submit" className="ll-btn ll-btn-primary ll-btn-lg" disabled={loading}
                        style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
