import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import supertest from 'supertest';
import express from 'express';
import session from 'express-session';
import authRoutes from '../routes/auth.routes';
import prisma from '../lib/prisma';
import { emailQueue } from '../lib/queue';
import { redisClient } from '../lib/redis';
import { config } from '../config';

describe('Production Session Persistence & Authentication Tests', () => {
  const usersDb = new Map<string, any>();

  beforeEach(() => {
    usersDb.clear();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // In-memory mock for prisma.user to enable testing without external DB connection
    jest.spyOn(prisma.user, 'findUnique').mockImplementation(((args: any) => {
      if (args.where?.id) {
        return Promise.resolve(usersDb.get(args.where.id) || null);
      }
      if (args.where?.email) {
        for (const u of usersDb.values()) {
          if (u.email === args.where.email) return Promise.resolve(u);
        }
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    }) as any);

    jest.spyOn(prisma.user, 'create').mockImplementation(((args: any) => {
      const newUser = {
        id: `usr_${Math.random().toString(36).substring(2, 9)}`,
        email: args.data.email,
        name: args.data.name || 'Demo Executive',
        avatarUrl: args.data.avatarUrl || null,
        googleId: null,
        slackAccount: null,
      };
      usersDb.set(newUser.id, newUser);
      return Promise.resolve(newUser);
    }) as any);
  });

  afterAll(async () => {
    try {
      await emailQueue.close();
      redisClient.disconnect();
    } catch (_) {}
    jest.restoreAllMocks();
  });

  it('1. Dev-login persists session and subsequent GET /api/auth/me returns 200 with user data', async () => {
    // Import main app
    const app = (await import('../index')).default;
    const agent = supertest.agent(app);

    const loginRes = await agent.post('/api/auth/dev-login').send({});
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).toBeDefined();
    expect(loginRes.body.user.email).toMatch(/^demo\.[a-z0-9]+@reachinbox\.ai$/);

    const userId = loginRes.body.user.id;

    // Subsequent call with session cookie
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toBeDefined();
    expect(meRes.body.user.id).toBe(userId);
  });

  it('2. Unauthenticated GET /api/auth/me returns 401 Unauthorized', async () => {
    const app = (await import('../index')).default;
    const res = await supertest(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('3. Dev-login safely restricts login: rejects admin account takeover', async () => {
    const app = (await import('../index')).default;
    const res = await supertest(app)
      .post('/api/auth/dev-login')
      .send({ email: config.admin.email });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('restricted to demo accounts');
  });

  it('4. Dev-login safely restricts login: rejects non-demo external email domains', async () => {
    const app = (await import('../index')).default;
    const res = await supertest(app)
      .post('/api/auth/dev-login')
      .send({ email: 'victim@external-company.com' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('restricted to demo accounts');
  });

  it('5. Dev-login safely restricts login: rejects existing accounts linked with Google', async () => {
    const googleUser = {
      id: 'usr_google_123',
      email: 'demo.googlelinked@reachinbox.ai',
      name: 'Google Linked Demo',
      avatarUrl: null,
      googleId: 'google-oauth-sub-12345',
      slackAccount: null,
    };
    usersDb.set(googleUser.id, googleUser);

    const app = (await import('../index')).default;
    const res = await supertest(app)
      .post('/api/auth/dev-login')
      .send({ email: 'demo.googlelinked@reachinbox.ai' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Google');
  });

  it('6. Production proxy & cookie verification: emits Set-Cookie with Secure and SameSite=None over HTTPS proxy', async () => {
    // Build a test express app with production settings (trust proxy = 1, secure = true, sameSite = 'none')
    const prodApp = express();
    prodApp.set('trust proxy', 1);
    prodApp.use(express.json());
    prodApp.use(
      session({
        secret: 'test_secret_for_prod_cookie_test',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: true,
          sameSite: 'none',
          httpOnly: true,
        },
      })
    );
    prodApp.use('/api/auth', authRoutes);

    // Simulated request through Render reverse proxy (TLS terminated at proxy)
    const res = await supertest(prodApp)
      .post('/api/auth/dev-login')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '203.0.113.195')
      .send({});

    expect(res.status).toBe(200);

    // Verify Set-Cookie header is present
    const setCookieHeader = res.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(Array.isArray(setCookieHeader)).toBe(true);

    const cookieStr = setCookieHeader[0];
    expect(cookieStr).toContain('connect.sid=');
    expect(cookieStr).toMatch(/Secure/i);
    expect(cookieStr).toMatch(/SameSite=None/i);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  it('7. Without trust proxy enabled, secure cookie is suppressed when proxy forwards HTTP', async () => {
    // Demonstration of the original root-cause bug
    const unproxiedApp = express();
    // Notice: trust proxy is NOT enabled
    unproxiedApp.use(express.json());
    unproxiedApp.use(
      session({
        secret: 'test_secret_for_prod_cookie_test',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: true,
          sameSite: 'none',
          httpOnly: true,
        },
      })
    );
    unproxiedApp.use('/api/auth', authRoutes);

    // When connection is HTTP to the container (even with X-Forwarded-Proto), without trust proxy, req.secure is false
    const res = await supertest(unproxiedApp)
      .post('/api/auth/dev-login')
      .set('X-Forwarded-Proto', 'https')
      .send({});

    expect(res.status).toBe(200);
    // Express-session suppresses Set-Cookie because req.secure is false!
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('8. Logout clears session and removes cookie', async () => {
    const app = (await import('../index')).default;
    const agent = supertest.agent(app);

    await agent.post('/api/auth/dev-login').send({});
    const meBefore = await agent.get('/api/auth/me');
    expect(meBefore.status).toBe(200);

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const meAfter = await agent.get('/api/auth/me');
    expect(meAfter.status).toBe(401);
  });
});
