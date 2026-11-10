import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import compression from 'compression';
import { testMySQLConnection } from './config/mysql.js';
import { seedDatabase } from './seed.js';
import { initPaymentLedgerTables } from './scripts/create_payment_ledger_tables.js';

// Import Routes
import itemsRoutes from './routes/items.js';
import uploadRoutes from './routes/upload.js';
import salesRoutes from './routes/sales.js';
import cashSessionsRoutes from './routes/cashSessions.js';
import usersRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import shopsRoutes from './routes/shops.js';
import updatesRoutes from './routes/updates.js';
import catalogRoutes from './routes/catalog.js';
import customersRoutes from './routes/customers.js';
import checkoutRoutes from './routes/checkout.js';
import expensesRoutes from './routes/expenses.js';
import damagedProductsRoutes from './routes/damagedProducts.js';
import vendorsRoutes from './routes/vendors.js';
import fuelExpensesRoutes from './routes/fuelExpenses.js';

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable Gzip/Brotli compression for fast JSON and asset transfer
app.use(compression());

// Trust proxy for secure cookies behind reverse proxies
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = [
  'https://nexflow-inventory.vercel.app', 
  'http://localhost:5173', 
  'http://localhost:5174',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('localhost')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-owner-password', 'x-user-role', 'x-shop-id', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['x-owner-password', 'x-user-role', 'x-shop-id']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Static Folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// API Routes
app.use('/api/items', itemsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/cash-sessions', cashSessionsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/shops', shopsRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/damaged-products', damagedProductsRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/fuel-expenses', fuelExpensesRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('POS Management System API is running on MySQL Database (online_pos_software)...');
});

// Custom 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

// Connect to MySQL Database
await testMySQLConnection();

const server = createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️  Port ${PORT} is in use. Retrying in 1.5s...`);
    setTimeout(() => {
      try {
        server.close();
      } catch (e) {}
      server.listen(PORT);
    }, 1500);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on MySQL in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
