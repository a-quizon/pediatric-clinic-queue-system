import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from "../../services/authService";
import { ref, get } from "firebase/database";
import { database } from "../../firebase/database";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const user = await loginUser(formData.email, formData.password);

      // Fetch user role from Realtime Database to determine where to redirect
      const userSnap = await get(ref(database, `users/${user.uid}`));
      let role = 'parent'; // default fallback

      if (userSnap.exists()) {
        const userData = userSnap.val();
        if (userData.role) {
          role = userData.role;
        }
      }

      setSuccess(true);

      // Redirect based on the user's role
      setTimeout(() => {
        if (role === 'doctor') {
          navigate('/doctor');
        } else if (role === 'secretary') {
          navigate('/secretary');
        } else {
          navigate('/parent');
        }
      }, 1500);

    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Login</h1>
      {error && <p style={{ color: 'red' }} id="error-message">{error}</p>}
      {success && <p style={{ color: 'green' }} id="success-message">Login successful! Redirecting...</p>}

      <form onSubmit={handleSubmit} id="login-form">
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="email" style={{ display: 'block' }}>Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="password" style={{ display: 'block' }}>Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          id="login-submit-btn"
          disabled={loading}
          style={{ padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <button
          type="button"
          id="login-register-btn"
          disabled={loading}
          onClick={() => navigate('/register')}
          style={{ padding: '10px 20px', marginLeft: '10px', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          Register
        </button>
      </form>
    </div>
  );
}
