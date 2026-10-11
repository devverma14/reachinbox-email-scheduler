import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import { bullBoardRouter } from './routes/queue.routes';
import { requireAdmin } from './middleware/admin.middleware';
import { initElasticsearchIndex } from './lib/elasticsearch';
import { reconcileOrphanedJobs } from './lib/queue';

const app = express();

// Middlewares
app.use(
  cors({
    origin: [config.clientUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.nodeEnv });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Protected Bull Board Dashboard (Admin Authorization Required)
app.use('/admin/queues', requireAdmin, bullBoardRouter);

// Start Server & Initialize Services (Only when not running in unit test mode)
let server: any;
if (config.nodeEnv !== 'test') {
  server = app.listen(config.port, async () => {
    console.log(`=======================================================`);
    console.log(`🚀 ReachInbox API Server running on port ${config.port}`);
    console.log(`📊 Bull Board Dashboard available at: http://localhost:${config.port}/admin/queues`);
    console.log(`=======================================================`);

    // Initialize Elasticsearch Index
    await initElasticsearchIndex();

    // Reconcile any orphaned/pending jobs on startup
    await reconcileOrphanedJobs();
  });
}

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server...');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app;
