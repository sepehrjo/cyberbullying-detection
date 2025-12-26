// src/components/Dashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Main moderator UI: shows flagged comments, handles actions, and displays
// retraining progress + final report
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import '../styles/Dashboard.css'
import History from './History'

const API = 'http://localhost:8000'

// Simple wrapper to include Bearer token automatically
function authFetch(url, opts = {}) {
  const token = localStorage.getItem('authToken')
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  })
}

function FlaggedComments() {
  // ─── State hooks ───────────────────────────────────────────────────────────
  const [comments, setComments]         = useState([])      // flagged comments queue
  const [search, setSearch]             = useState('')      // search filter text
  const [minConf, setMinConf]           = useState('')      // min confidence filter
  const [progress, setProgress]         = useState(0)       // retrain % progress
  const [retraining, setRetraining]     = useState(false)   // is retraining in progress?
  const [retrainData, setRetrainData]   = useState([])      // array of {epoch, avg_loss, f1}
  const [bestF1, setBestF1]             = useState(null)    // best F1 from retraining
  const [trainingStarted, setTrainingStarted] = useState(false) // flag for retraining start
  const esRef                           = useRef(null)      // EventSource reference
  const nav                             = useNavigate()     // React Router navigator

  // ─── Logout handler ─────────────────────────────────────────────────────────
  function handleLogout() {
    localStorage.removeItem('authToken')
    nav('/auth', { replace: true })
  }

  // ─── Fetch queue on mount (and whenever we come back to root) ────────────────
  useEffect(() => {
    fetchQueue()
  }, [])

  async function fetchQueue() {
    const res = await authFetch(`${API}/queue`)
    if (res.status === 401) {
      // Not authorized anymore; force login
      return nav('/auth', { replace: true })
    }
    setComments(await res.json())
  }

  // ─── Approve or reject an item (persist action) ──────────────────────────────
  async function act(id, action) {
    const res = await authFetch(`${API}/action`, {
      method: 'POST',
      body: JSON.stringify({ comment_id: id, action })
    })
    if (res.ok) {
      // Remove from local queue once backend confirms recording
      setComments(cs => cs.filter(c => c.comment_id !== id))
    } else {
      console.error('Action failed:', await res.text())
    }
  }

  // ─── Permanently delete a flagged comment from the queue ─────────────────────
  async function del(id) {
    const res = await authFetch(`${API}/queue/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setComments(cs => cs.filter(c => c.comment_id !== id))
    }
  }

  // ─── Kick off retraining on server; open SSE stream ─────────────────────────
  function startRetrain() {
    if (!window.confirm('Retrain the model now?')) return

    // Reset any previous retrain data
    setRetraining(true)
    setProgress(0)
    setTrainingStarted(false)
    setRetrainData([])
    setBestF1(null)

    // Trigger retrain on backend
    authFetch(`${API}/retrain`, { method: 'POST' }).catch(console.error)

    // Listen for server‐sent events
    const es = new EventSource(`${API}/retrain/stream`)
    esRef.current = es

    es.onmessage = e => {
      const msg = JSON.parse(e.data)
      console.log('[Retrain SSE]', msg)

      switch (msg.type) {
        case 'training_started':
          setTrainingStarted(true)
          break

        case 'progress':
          // update progress bar (%)
          setProgress(msg.progress)
          break

        case 'epoch_end':
          // append new epoch summary {epoch, avg_loss, f1}
          setRetrainData(prev => [
            ...prev,
            {
              epoch: msg.epoch,
              avg_loss: msg.avg_loss,
              f1: msg.f1
            }
          ])
          break

        case 'model_saved':
          // record best F1 when model is overwritten
          setBestF1(msg.f1)
          break

        case 'complete':
          // final “complete” event
          setProgress(100)
          es.close()
          setTimeout(() => setRetraining(false), 500)
          break

        default:
          // ignore any other raw/summary events
          break
      }
    }

    es.onerror = () => {
      es.close()
      setRetraining(false)
    }
  }

  // ─── Cancel retraining by sending SIGINT to subprocess ───────────────────────
  async function cancelRetrain() {
    await authFetch(`${API}/retrain/cancel`, { method: 'POST' })
    esRef.current?.close()
    setRetraining(false)
  }

  // ─── Apply search + min‐confidence filters on flagged comments ───────────────
  const filtered = comments.filter(c => {
    const t = search.trim().toLowerCase()
    return (
      (!t || c.text.toLowerCase().includes(t) || c.comment_id.includes(t)) &&
      (!minConf || (c.confidence * 100) >= parseFloat(minConf))
    )
  })

  return (
    <div className="container">
      {/* ─── Dashboard Header (Title + Logout) ────────────────────────────── */}
      <header className="dashboard-header">
        <h1>Flagged Comments</h1>
        <button className="logout-button" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {/* ─── Explanation / Training Overview ──────────────────────────────────── */}
      <div className="explanation-section">
        <h2>How to Use This Dashboard</h2>
        <p>
          • <strong>Approve</strong> marks a flagged comment as “true positive” (your model
          correctly flagged a cyberbully comment).<br/>
          • <strong>Reject</strong> marks a comment as “false positive” (your model flagged
          a non‐cyberbully comment incorrectly).<br/>
          • <strong>Delete</strong> simply removes the comment from the queue without recording
          feedback (no change to training data).<br/>
        </p>
        <hr/>
        <p>
          After you take <strong>Approve</strong> or <strong>Reject</strong> actions, our system
          stores that decision in the database. Once you click “Retrain Model”, the backend
          gathers all moderator feedback as new labeled examples, merges them with existing
          data, and re‐trains the BERT+LSTM model to improve accuracy. The final metrics
          (average loss, F1 score per epoch, and any “Model Saved” events) appear below
          both in your console and in the “Retraining Report” table.
        </p>
      </div>

      {/* ─── Filters Bar (Search, MinConf, History, Retrain) ───────────────────── */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search by ID or text…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input
          type="number"
          placeholder="Min % confidence"
          value={minConf}
          onChange={e => setMinConf(e.target.value)}
        />
        <button className="history-button" onClick={() => nav('/history')}>
          View History
        </button>
        {retraining ? (
          <button className="cancel-button" onClick={cancelRetrain}>
            Cancel Retrain
          </button>
        ) : (
          <button className="retrain-button" onClick={startRetrain}>
            Retrain Model
          </button>
        )}
      </div>

      {/* ─── Progress Bar (when retraining) ──────────────────────────────────── */}
      {retraining && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
            {progress}%
          </div>
        </div>
      )}

      {/* ─── Retraining Report (table + best‐F1 badge) ─────────────────────────── */}
      {trainingStarted && (
        <div className="retrain-report">
          <h2>Retraining Report</h2>
          <table>
            <thead>
              <tr>
                <th>Epoch</th>
                <th>Avg Loss</th>
                <th>F1 Score</th>
              </tr>
            </thead>
            <tbody>
              {retrainData.map(entry => (
                <tr key={entry.epoch}>
                  <td>{entry.epoch}</td>
                  <td>{entry.avg_loss}</td>
                  <td>{entry.f1}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bestF1 !== null && (
            <p className="best-f1">
              🎉 New best F1 saved: <strong>{bestF1}</strong>
            </p>
          )}
        </div>
      )}

      {/* ─── Flagged Comments Table ───────────────────────────────────────────── */}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Comment</th>
            <th>Confidence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.comment_id}>
              <td>{c.comment_id}</td>
              <td>{c.text}</td>
              <td>{(c.confidence * 100).toFixed(1)}%</td>
              <td>
                <button
                  className="approve-button"
                  onClick={() => act(c.comment_id, 'approved')}
                >
                  Approve
                </button>
                <button
                  className="reject-button"
                  onClick={() => act(c.comment_id, 'rejected')}
                >
                  Reject
                </button>
                <button
                  className="delete-button"
                  onClick={() => del(c.comment_id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistoryWrapper() {
  const nav = useNavigate()
  return (
    <div className="container">
      <button className="back-button" onClick={() => nav('/')}>
        ← Back to Queue
      </button>
      <History />
    </div>
  )
}

export default function Dashboard() {
  return (
    <Routes>
      <Route path="/" element={<FlaggedComments />} />
      <Route path="/history" element={<HistoryWrapper />} />
    </Routes>
  )
}
