// Main API entry point for Vercel
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Import all route modules
const authRoutes = require('../backend/routes/authRoutes');
const brandRoutes = require('../backend/routes/brandRoutes');
const groupRoutes = require('../backend/routes/groupRoutes');
const makeRoutes = require('../backend/routes/makeRoutes');
const itemRoutes = require('../backend/routes/itemRoutes');
const partyRoutes = require('../backend/routes/partyRoutes');
const purchaseRoutes = require('../backend/routes/purchaseRoutes');
const accountingPeriodRoutes = require('../backend/routes/accountingPeriodRoutes');
const salesRoutes = require('../backend/routes/salesRoutes');
const purchaseReturnRoutes = require('../backend/routes/purchaseReturnRoutes');
const companyRoutes = require('../backend/routes/companyRoutes');
const dashboardRoutes = require('../backend/routes/dashboard');

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/makes', makeRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/party', partyRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchase-return', purchaseReturnRoutes);
app.use('/api/accounting-periods', accountingPeriodRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export for Vercel
module.exports = app;