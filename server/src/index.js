require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { prisma, connectDb, disconnectDb } = require('./db');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./auth/auth.routes');
const itemsRoutes = require('./items/items.routes');
const suppliersRoutes = require('./suppliers/suppliers.routes');
const locationsRoutes = require('./locations/locations.routes');
const itemSuppliersRoutes = require('./item-suppliers/item-suppliers.routes');
const bomsRoutes = require('./boms/boms.routes');
const inventoryRoutes = require('./inventory/inventory.routes');
const purchaseOrderRoutes = require('./purchase-orders/po.routes');
const workOrderRoutes = require('./work-orders/wo.routes');
const mrpRoutes = require('./mrp/mrp.routes');
const adminRoutes = require('./admin/admin.routes');
const superRoutes = require('./super/super.routes');
const dashboardRoutes = require('./dashboard/dashboard.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/v1/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/items', itemsRoutes);
app.use('/api/v1/items/:itemId/suppliers', itemSuppliersRoutes);
app.use('/api/v1/suppliers', suppliersRoutes);
app.use('/api/v1/locations', locationsRoutes);
app.use('/api/v1/boms', bomsRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/work-orders', workOrderRoutes);
app.use('/api/v1/mrp', mrpRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/super', superRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    data: null,
    meta: null,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

// Start server
async function start() {
  try {
    await connectDb();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await disconnectDb();
  process.exit(0);
});
