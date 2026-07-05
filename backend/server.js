require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes    = require('./routes/auth');
const extractRoutes = require('./routes/extract');
const webhookRoutes = require('./routes/webhook');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Raw body needed for Paystack webhook signature check
app.use('/api/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use('/api/auth',    authRoutes);
app.use('/api/extract', extractRoutes);
app.use('/api/webhook', webhookRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LeadsHub backend running on port ${PORT}`));
