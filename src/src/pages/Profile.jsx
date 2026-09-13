// src/src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const Profile = () => {
  const { user, isLawyer } = useAuth();
  const [form, setForm] = useState({
    bio: '', barRegistrationNumber: '', yearsOfExperience: '', feePerHour: '', practiceAreas: []
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await api.get('/auth/me');
      const u = data.user;
      setForm({
        bio: u.bio || '', barRegistrationNumber: u.barRegistrationNumber || '',
        yearsOfExperience: u.yearsOfExperience || '', feePerHour: u.feePerHour || '',
        practiceAreas: u.practiceAreas || []
      });
    };
    loadProfile();
  }, []);

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setSaved(false); };
  const toggleArea = (area) => {
    const current = form.practiceAreas;
    setForm({ ...form, practiceAreas: current.includes(area) ? current.filter(a => a !== area) : [...current, area] });
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
    } catch (err) { alert(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', marginBottom: '24px' }}>Edit Profile</h1>

      <div className="ll-card">
        <form onSubmit={handleSubmit}>
          {/* Read-only fields */}
          <div style={{ marginBottom: '16px' }}>
            <label className="ll-label">Full Name</label>
            <input className="ll-input" type="text" value={user?.name || ''} disabled style={{ opacity: 0.6 }} />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Name cannot be changed</small>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="ll-label">Email</label>
            <input className="ll-input" type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Email cannot be changed</small>
          </div>

          {/* Lawyer fields */}
          {isLawyer && (
            <div style={{ background: 'var(--accent-light)', padding: '20px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
              <h6 style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Professional Details</h6>
              <div style={{ marginBottom: '12px' }}>
                <label className="ll-label">Bar Registration Number</label>
                <input className="ll-input" type="text" name="barRegistrationNumber" placeholder="e.g. BAR-DL-2020-001"
                       value={form.barRegistrationNumber} onChange={handleChange} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="ll-label">Years of Experience</label>
                  <input className="ll-input" type="number" name="yearsOfExperience" min="0" max="50" placeholder="e.g. 5"
                         value={form.yearsOfExperience} onChange={handleChange} />
                </div>
                <div>
                  <label className="ll-label">Fee (₹/hr)</label>
                  <input className="ll-input" type="number" name="feePerHour" min="100" step="100" placeholder="e.g. 2500"
                         value={form.feePerHour} onChange={handleChange} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label className="ll-label">Practice Areas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PRACTICE_AREAS.map(area => (
                    <button key={area} type="button"
                            className={`ll-btn ll-btn-sm ${form.practiceAreas.includes(area) ? 'll-btn-primary' : 'll-btn-outline'}`}
                            onClick={() => toggleArea(area)}>
                      {area.charAt(0).toUpperCase() + area.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="ll-label">Bio</label>
                <textarea className="ll-input" name="bio" rows={3} placeholder="Describe your expertise..."
                          value={form.bio} onChange={handleChange} style={{ resize: 'vertical' }} />
              </div>
            </div>
          )}

          {/* Client bio */}
          {!isLawyer && (
            <div style={{ marginBottom: '16px' }}>
              <label className="ll-label">Bio</label>
              <textarea className="ll-input" name="bio" rows={2} placeholder="Tell us about yourself..."
                        value={form.bio} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" className="ll-btn ll-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
                ✓ Profile updated!
              </motion.span>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default Profile;
