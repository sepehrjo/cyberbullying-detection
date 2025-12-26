//src/components/ProtectedRoute.js
// Wrapper that redirects to /auth if no authToken is present

import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('authToken');
  // If no token, send user back to login/register
  return token
    ? children
    : <Navigate to="/auth" replace />;
}



