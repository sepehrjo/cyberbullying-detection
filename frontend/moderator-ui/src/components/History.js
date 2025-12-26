// src/components/History.js
// Fetches and displays past moderator actions

import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';

export default function History() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/history')
      .then(r => r.json())
      .then(setHistory)
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1>Moderator Action History</h1>
      {history.length === 0 ? (
        <p>No actions recorded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Comment ID</th>
              <th>Text</th>
              <th>Action</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {history.map((e, i) => (
              <tr key={i}>
                <td>{e.comment_id}</td>
                <td>{e.text || '-'}</td>
                <td>
                  <span className={`history-chip ${e.action}`}>
                    {e.action.charAt(0).toUpperCase() + e.action.slice(1)}
                  </span>
                </td>
                <td>{new Date(e.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
