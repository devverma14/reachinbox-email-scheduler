import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  serverUrl: process.env.SERVER_URL || 'http://localhost:4000',
  sessionSecret: process.env.SESSION_SECRET || 'super_secret_reachinbox_key',

  databaseUrl: process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox_secret_password@localhost:5432/reachinbox_db?schema=public',

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: `${process.env.SERVER_URL || 'http://localhost:4000'}/api/auth/google/callback`,
  },

  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || `${process.env.SERVER_URL || 'http://localhost:4000'}/api/auth/slack/callback`,
  },

  ethereal: {
    user: process.env.ETHEREAL_USER || '',
    pass: process.env.ETHEREAL_PASS || '',
  },

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    defaultHourlyLimit: parseInt(process.env.DEFAULT_HOURLY_LIMIT || '50', 10),
    defaultMinDelayMs: parseInt(process.env.DEFAULT_MIN_DELAY_MS || '2000', 10),
  },

  admin: {
    key: process.env.ADMIN_KEY || 'reachinbox_admin_secret_key_2026',
    email: process.env.ADMIN_EMAIL || 'admin@reachinbox.ai',
  },
};
