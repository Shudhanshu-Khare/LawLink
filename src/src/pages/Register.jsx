import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const LawyerFields = ({ formData, onChange, onPracticeAreaToggle }) => (
  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
    <div className="p-3 mb-3 rounded" style={{ background: '#f1f5f9' }}>
      <h6 className="fw-bold mb-3" style={{ color: '#334155' }}>Professional Details</h6>
      <div className="mb-3">
        <label className="form-label">Bar Registration Number</label>
        <input type="text" name="barRegistrationNumber" className="form-control"
               placeholder="e.g. BAR-DL-2020-001"
               value={formData.barRegistrationNumber} onChange={onChange} />
      </div>
      <div className="row mb-3">
        <div className="col-6">
          <label className="form-label">Years of Experience</label>
          <input type="number" name="yearsOfExperience" className="form-control"
                 min="0" max="50" placeholder="e.g. 5"
                 value={formData.yearsOfExperience} onChange={onChange} />
        </div>
        <div className="col-6">
          <label className="form-label">Fee (Rs./hr)</label>
          <input type="number" name="feePerHour" className="form-control"
                 min="1" step="1" placeholder="e.g. 2500"
                 value={formData.feePerHour} onChange={onChange} />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label">Practice Areas</label>
        <div className="d-flex flex-wrap gap-2">
          {PRACTICE_AREAS.map(area => (
            <button key={area} type="button"
                    className={`btn btn-sm ${formData.practiceAreas.includes(area) ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => onPracticeAreaToggle(area)}>
              {area.charAt(0).toUpperCase() + area.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2">
        <label className="form-label">Short Bio</label>
        <textarea name="bio" className="form-control" rows={2}
                  placeholder="Describe your expertise..."
                  value={formData.bio} onChange={onChange} />
      </div>
    </div>
  </motion.div>
);

const Register = () => {
  const location = useLocation();
  const googleData = location.state?.googleData || null;

  const [step, setStep] = useState(googleData ? 'profile' : 'form'); 

  const [formData, setFormData] = useState({
    name: googleData?.name || '',
    email: googleData?.email || '',
    password: '',
    confirmPassword: '',
    role: 'client',
    barRegistrationNumber: '', yearsOfExperience: '', feePerHour: '', practiceAreas: [], bio: ''
  });
  const [otp, setOtp] = useState('');
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

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (formData.role === 'lawyer') {
      if (!formData.barRegistrationNumber) return setError('Bar registration number is required');
      if (!formData.feePerHour || formData.feePerHour <= 0) return setError('Fee per hour is required');
      if (!formData.yearsOfExperience) return setError('Years of experience is required');
      if (formData.practiceAreas.length === 0) return setError('Select at least one practice area');
    }

    setLoading(true);
    try {
      const { confirmPassword, ...submitData } = formData;
      if (submitData.yearsOfExperience) submitData.yearsOfExperience = Number(submitData.yearsOfExperience);
      if (submitData.feePerHour) submitData.feePerHour = Number(submitData.feePerHour);
      await api.post('/auth/register', submitData);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email: formData.email, otp });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await api.post('/auth/resend-otp', { email: formData.email });
      setError('');
      alert('New OTP sent!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend');
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential
      });
      if (data.newUser) {
        navigate('/register', { state: { googleData: data.googleData }, replace: true });
        window.location.reload();
      } else {
        login(data.token, data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  const isLawyer = formData.role === 'lawyer';

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
         style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '40px 0' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="card shadow-lg border-0" style={{ width: '520px', borderRadius: '16px' }}>
        <div className="card-body p-4">

          {step === 'otp' && (
            <>
              <h2 className="text-center mb-1 fw-bold">Verify Email</h2>
              <p className="text-center text-muted mb-4">
                Enter the 6-digit code sent to <strong>{formData.email}</strong>
              </p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <form onSubmit={handleVerifyOTP}>
                <div className="mb-3">
                  <input type="text" className="form-control form-control-lg text-center"
                         placeholder="------" maxLength={6}
                         value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                         style={{ letterSpacing: '12px', fontSize: '24px', fontWeight: 'bold' }}
                         required />
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>
              </form>

              <div className="text-center mt-3">
                <button className="btn btn-link btn-sm" onClick={handleResend}>
                  Didn't receive it? Resend OTP
                </button>
              </div>
              <div className="text-center">
                <button className="btn btn-link btn-sm text-muted" onClick={() => setStep('form')}>
                  ← Back to registration
                </button>
              </div>
            </>
          )}

          {step === 'profile' && googleData && (
            <>
              <h2 className="text-center mb-1 fw-bold">Complete Your Profile</h2>
              <p className="text-center text-muted mb-4">
                Signed in as <strong>{googleData.email}</strong>
              </p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <form onSubmit={handleGoogleRegister}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input type="text" className="form-control" value={googleData.name} disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={googleData.email} disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label">I am a</label>
                  <select name="role" className="form-select" value={formData.role} onChange={handleChange}>
                    <option value="client">Client — I need legal help</option>
                    <option value="lawyer">Lawyer — I provide legal services</option>
                  </select>
                </div>

                <AnimatePresence>
                  {isLawyer && (
                    <LawyerFields
                      formData={formData}
                      onChange={handleChange}
                      onPracticeAreaToggle={togglePracticeArea}
                    />
                  )}
                </AnimatePresence>

                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </>
          )}

          {step === 'form' && (
            <>
              <h2 className="text-center mb-1 fw-bold">Create Account</h2>
              <p className="text-center text-muted mb-4">Join LawLink today</p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <div className="d-flex justify-content-center mb-3">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-up failed')}
                  text="signup_with"
                  shape="rectangular"
                  width="460"
                />
              </div>

              <div className="d-flex align-items-center mb-3">
                <hr className="flex-grow-1" />
                <span className="px-3 text-muted small">OR register with email</span>
                <hr className="flex-grow-1" />
              </div>

              <form onSubmit={handleEmailRegister}>
                <div className="mb-3">
                  <label className="form-label">Full Name</label>
                  <input type="text" name="name" className="form-control"
                         value={formData.name} onChange={handleChange} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" className="form-control"
                         value={formData.email} onChange={handleChange} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">I am a</label>
                  <select name="role" className="form-select" value={formData.role} onChange={handleChange}>
                    <option value="client">Client — I need legal help</option>
                    <option value="lawyer">Lawyer — I provide legal services</option>
                  </select>
                </div>

                <AnimatePresence>
                  {isLawyer && (
                    <LawyerFields
                      formData={formData}
                      onChange={handleChange}
                      onPracticeAreaToggle={togglePracticeArea}
                    />
                  )}
                </AnimatePresence>

                <div className="row mb-3">
                  <div className="col">
                    <label className="form-label">Password</label>
                    <input type="password" name="password" className="form-control"
                           value={formData.password} onChange={handleChange} required minLength={6} />
                  </div>
                  <div className="col">
                    <label className="form-label">Confirm</label>
                    <input type="password" name="confirmPassword" className="form-control"
                           value={formData.confirmPassword} onChange={handleChange} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Register & Verify Email'}
                </button>
              </form>

              <p className="text-center mt-3 mb-0">
                Already have an account? <Link to="/login">Sign In</Link>
              </p>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
};

export default Register;
