/**
 * GetDieted — server.js
 * ─────────────────────────────────────────────
 * A lightweight Express proxy that:
 *  1. Reads the Anthropic API key from .env (never exposed to the browser)
 *  2. Serves the static frontend files (index.html, style.css, app.js)
 *  3. Exposes POST /api/diet → forwards the request to Anthropic
 *
 * Usage:
 *   node server.js        (or: npm start)
 *   Then open: http://localhost:3001
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// ── Validate key on startup ──
if (!API_KEY || API_KEY === 'sk-ant-api03-YOUR_KEY_HERE') {
  console.error('\n⚠️  ERROR: No valid ANTHROPIC_API_KEY found in .env');
  console.error('   Copy .env.example to .env and add your real key.\n');
  process.exit(1);
}

app.use(express.json({ limit: '2mb' }));
app.use(cors());

// ── Serve static frontend files ──
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────
// POST /api/diet  — Anthropic proxy
// ─────────────────────────────────
const dietHandler = require('./api/diet');
app.all('/api/diet', dietHandler);

// ── Fallback: serve index.html for any unknown GET ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Export for Vercel Serverless Function ──
module.exports = app;

// ── Only listen actively if run locally via Node ──
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🥗 GetDieted server running at http://localhost:${PORT}`);
    console.log(`   API key: ${API_KEY.slice(0, 18)}... (hidden from browser)\n`);
  });
}
