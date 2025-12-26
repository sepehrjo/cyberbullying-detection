// src/index.js
// Application entry point: renders <App /> into the root DOM node

import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';  // global resets, etc.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

