import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const Profile = () => {
  const { user, isLawyer } = useAuth();
  const [form, setForm] = useState({
    bio: '',
    barRegistrationNumber: '', yearsOfExperience: '', feePerHour: '', practiceAreas: []
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await api.get('/auth/me');
      const u = data.user;
      setForm({
        bio: u.bio || '',
        barRegistrationNumber: u.barRegistrationNumber || '',
        yearsOfExperience: u.yearsOfExperience || '',
        feePerHour: u.feePerHour || '',
        practiceAreas: u.practiceAreas || []
      });
    };
    loadProfile();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const toggleArea = (area) => {
    const current = form.practiceAreas;
    if (current.includes(area)) {
      setForm({ ...form, practiceAreas: current.filter(a => a !== area) });
    } else {
      setForm({ ...form, practiceAreas: [...current, area] });
    }
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.yearsOfExperience) payload.yearsOfExperience = Number(payload.yearsOfExperience);
      if (payload.feePerHour) payload.feePerHour = Number(payload.feePerHour);
      await api.put('/auth/profile', payload);
      setSaved(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 640 }}>
      <h2 className="fw-bold mb-4">Edit Profile</h2>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-control" value={user?.name || ''} disabled />
              <small className="text-muted">Name cannot be changed</small>
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={user?.email || ''} disabled />
              <small className="text-muted">Email cannot be changed</small>
            </div>

            {isLawyer && (
              <div className="p-3 rounded mb-3" style={{ background: '#f1f5f9' }}>
                <h6 className="fw-bold mb-3" style={{ color: '#334155' }}>Professional Details</h6>

                <div className="mb-3">
                  <label className="form-label">Bar Registration Number</label>
                  <input type="text" name="barRegistrationNumber" className="form-control"
                         placeholder="e.g. BAR-DL-2020-001"
                         value={form.barRegistrationNumber} onChange={handleChange} />
                </div>

                <div className="row mb-3">
                  <div className="col-6">
                    <label className="form-label">Years of Experience</label>
                    <input type="number" name="yearsOfExperience" className="form-control"
                           min="0" max="50" placeholder="e.g. 5"
                           value={form.yearsOfExperience} onChange={handleChange} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Fee (Rs./hr)</label>
                    <input type="number" name="feePerHour" className="form-control"
                           min="1" step="1" placeholder="e.g. 2500"
                           value={form.feePerHour} onChange={handleChange} />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Practice Areas</label>
                  <div className="d-flex flex-wrap gap-2">
                    {PRACTICE_AREAS.map(area => (
                      <button
                        key={area} type="button"
                        className={`btn btn-sm ${form.practiceAreas.includes(area) ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => toggleArea(area)}
                      >
                        {area.charAt(0).toUpperCase() + area.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label">Bio</label>
                  <textarea name="bio" className="form-control" rows={3}
                            placeholder="Describe your expertise and experience..."
                            value={form.bio} onChange={handleChange} />
                </div>
              </div>
            )}

            {!isLawyer && (
              <div className="mb-3">
                <label className="form-label">Bio</label>
                <textarea name="bio" className="form-control" rows={2}
                          placeholder="Tell us about yourself..."
                          value={form.bio} onChange={handleChange} />
              </div>
            )}

            <div className="d-flex align-items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                             className="text-success fw-bold">
                  Profile updated!
                </motion.span>
              )}
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
