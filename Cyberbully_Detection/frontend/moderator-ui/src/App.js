// src/App.js

import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import AuthPage       from './components/AuthPage'
import Dashboard      from './components/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'


export default function App() {
  useEffect(() => {
    // Force logout on full refresh
    localStorage.removeItem('authToken')
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Unprotected login/register */}
        <Route path="/auth" element={<AuthPage />} />

        {/* All other paths require valid token */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch-all: send back to /auth */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

