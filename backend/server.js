const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const PREMIUM_API_KEY = process.env.PREMIUM_API_KEY || '';
const CONTACT_RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const CONTACT_RATE_LIMIT_MAX_REQUESTS = Number(process.env.CONTACT_RATE_LIMIT_MAX_REQUESTS) || 5;

const contactRateLimitStore = new Map();

app.disable('x-powered-by');

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS policy'));
    },
  })
);

app.use(express.json({ limit: '30kb' }));
app.use(morgan('dev'));

function validateContactPayload(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const errors = [];

  if (!name || name.length < 2 || name.length > 80) {
    errors.push('name must be between 2 and 80 characters');
  }

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 120) {
    errors.push('email must be a valid email address');
  }

  if (!message || message.length < 10 || message.length > 3000) {
    errors.push('message must be between 10 and 3000 characters');
  }

  return {
    cleaned: { name, email, message },
    errors,
  };
}

function contactRateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const state = contactRateLimitStore.get(key) || { count: 0, windowStart: now };

  if (now - state.windowStart > CONTACT_RATE_LIMIT_WINDOW_MS) {
    state.count = 0;
    state.windowStart = now;
  }

  state.count += 1;
  contactRateLimitStore.set(key, state);

  if (state.count > CONTACT_RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again shortly.',
      requestId: req.requestId,
    });
  }

  return next();
}

function requirePremiumAuth(req, res, next) {
  if (!PREMIUM_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Premium service is not configured.',
      requestId: req.requestId,
    });
  }

  const incomingKey = req.get('x-api-key');
  if (!incomingKey || incomingKey !== PREMIUM_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized premium access.',
      requestId: req.requestId,
    });
  }

  return next();
}

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Latitud 0 Backend is running',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

app.post('/api/contact', contactRateLimit, (req, res) => {
  const { cleaned, errors } = validateContactPayload(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      requestId: req.requestId,
    });
  }

  console.log(`Contact from ${cleaned.name} (${cleaned.email}), message chars: ${cleaned.message.length}`);
  return res.status(202).json({
    success: true,
    message: 'Mensaje recibido correctamente.',
    requestId: req.requestId,
  });
});

app.get('/api/premium/features', requirePremiumAuth, (req, res) => {
  res.status(200).json({
    success: true,
    plan: 'premium',
    features: [
      'priority_support',
      'advanced_analytics',
      'custom_branding',
      'team_workspaces',
    ],
    requestId: req.requestId,
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Unhandled error', {
    requestId: req.requestId,
    message: err.message,
  });

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId: req.requestId,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    requestId: req.requestId,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
