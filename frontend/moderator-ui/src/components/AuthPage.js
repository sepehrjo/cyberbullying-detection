// src/components/AuthPage.js

// Handles both Login and Register modes in a single form.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

export default function AuthPage() {
  // ‘mode’ toggles between 'login' and 'register'
  const [mode, setMode]     = useState('login');
  const [email, setEmail]   = useState('');
  const [password, setPass] = useState('');
  const [confirm, setConf]  = useState('');
  const [error, setError]   = useState('');
  const nav = useNavigate();

  // Called on form submission
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // Basic validation
    if (!email || !password || (mode === 'register' && password !== confirm)) {
      setError('Fill all fields (and match passwords).');
      return;
    }

    // Determine the endpoint based on mode
    const url = mode === 'login' ? '/auth/login' : '/auth/register';
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.msg || 'Unknown error');

      if (mode === 'login') {
        // Save token and navigate to dashboard
        localStorage.setItem('authToken', data.access_token);
        nav('/', { replace: true });
      } else {
        // After successful registration, switch to login
        setMode('login');
        setError('Registered successfully! Please log in.');
      }

    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-container">
      <h2>{mode === 'login' ? 'Moderator Login' : 'Register Account'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPass(e.target.value)}
        />
        {mode === 'register' && (
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={e => setConf(e.target.value)}
          />
        )}
        {error && <div className="error">{error}</div>}
        <button type="submit">
          {mode === 'login' ? 'Log In' : 'Register'}
        </button>
      </form>
      <p>
        {mode === 'login'
          ? "Don't have an account? "
          : "Already have one? "}
        <a
          href="#"
          onClick={e => {
            e.preventDefault();
            setMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login' ? 'Register' : 'Log In'}
        </a>
      </p>
    </div>
  );
}
