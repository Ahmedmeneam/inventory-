import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDbSchema } from './src/server/db/index.ts';
import { setupRouter } from './src/server/routes/setup.ts';
import { authRouter } from './src/server/routes/auth.ts';
import { usersRouter } from './src/server/routes/users.ts';
import { dashboardRouter } from './src/server/routes/dashboard.ts';
import { custodyRouter } from './src/server/routes/custody.ts';
import { itemsRouter } from './src/server/routes/items.ts';
import { importRouter } from './src/server/routes/import.ts';
import { movementsRouter } from './src/server/routes/movements.ts';
import { ledgerRouter } from './src/server/routes/ledger.ts';
import { inventoryRouter } from './src/server/routes/inventory.ts';
import { backupRouter } from './src/server/routes/backup.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Initialize clean SQLite schema
  initDbSchema();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.use('/api/setup', setupRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/custodies', custodyRouter);
  app.use('/api/custodies', importRouter);
  app.use('/api/custodies', movementsRouter);
  app.use('/api/movements', movementsRouter);
  app.use('/api/movements', ledgerRouter);
  app.use('/api/ledger', ledgerRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/backup', backupRouter);
  app.use('/api', itemsRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  if (!isProd) {
    // Mount Vite middleware for dev
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
