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
  // Steps: 'choose' (Google button) → 'profile' (complete role + details) → done

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

  // Google Sign-Up
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential,
        mode: 'register'
      });

      // Register mode: backend only returns newUser for unregistered users
      setGoogleData(data.googleData);
      setStep('profile');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  // Complete profile and register
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

  // Lawyer fields (inline JSX, NOT a component — prevents focus loss on keystroke)
  const lawyerFields = (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
      <div className="p-3 mb-3 rounded" style={{ background: '#f1f5f9' }}>
        <h6 className="fw-bold mb-3" style={{ color: '#334155' }}>Professional Details</h6>
        <div className="mb-3">
          <label className="form-label">Bar Registration Number</label>
          <input type="text" name="barRegistrationNumber" className="form-control"
                 placeholder="e.g. BAR-DL-2020-001"
                 value={formData.barRegistrationNumber} onChange={handleChange} />
        </div>
        <div className="row mb-3">
          <div className="col-6">
            <label className="form-label">Years of Experience</label>
            <input type="number" name="yearsOfExperience" className="form-control"
                   min="0" max="50" placeholder="e.g. 5"
                   value={formData.yearsOfExperience} onChange={handleChange} />
          </div>
          <div className="col-6">
            <label className="form-label">Fee (Rs./hr)</label>
            <input type="number" name="feePerHour" className="form-control"
                   min="100" step="100" placeholder="e.g. 2500"
                   value={formData.feePerHour} onChange={handleChange} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Practice Areas</label>
          <div className="d-flex flex-wrap gap-2">
            {PRACTICE_AREAS.map(area => (
              <button key={area} type="button"
                      className={`btn btn-sm ${formData.practiceAreas.includes(area) ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => togglePracticeArea(area)}>
                {area.charAt(0).toUpperCase() + area.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-2">
          <label className="form-label">Short Bio</label>
          <textarea name="bio" className="form-control" rows={2}
                    placeholder="Describe your expertise..."
                    value={formData.bio} onChange={handleChange} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
         style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '40px 0' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="card shadow-lg border-0" style={{ width: '520px', borderRadius: '16px' }}>
        <div className="card-body p-4">

          {/* ────── STEP: Profile Completion (after Google sign-up) ────── */}
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

                <AnimatePresence>{isLawyer && lawyerFields}</AnimatePresence>

                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </>
          )}

          {/* ────── STEP: Google Sign-Up ────── */}
          {step === 'choose' && (
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
