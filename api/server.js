const express = require('express');
const cors = require('cors');
const path = require('path');
const analyzeHandler = require('./analyze.js');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/analyze', analyzeHandler);

app.get('/api/test-env', (req, res) => {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  res.json({
    hasToken: !!token,
    hasGH_TOKEN: !!process.env.GH_TOKEN,
    hasGITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files in production (k3s/Docker)
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // SPA fallback - send index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (isProduction) {
    console.log('Serving static files from dist/');
  }
});
