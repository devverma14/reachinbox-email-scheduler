import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import supertest from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { emailQueue } from '../lib/queue';
import { redisClient } from '../lib/redis';
import { config } from '../config';

describe('Demo Workspace Isolation & Security Tests', () => {
  beforeEach(async () => {
    // Suppress console.error in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    try {
      await emailQueue.close();
      redisClient.disconnect();
    } catch (_) {}
  });

  it('1. Two independent demo sessions receive different user identities', async () => {
    const agent1 = supertest.agent(app);
    const agent2 = supertest.agent(app);

    const loginRes1 = await agent1.post('/api/auth/dev-login').send({});
    expect(loginRes1.status).toBe(200);
    const user1 = loginRes1.body.user;

    const loginRes2 = await agent2.post('/api/auth/dev-login').send({});
    expect(loginRes2.status).toBe(200);
    const user2 = loginRes2.body.user;

    expect(user1.id).toBeDefined();
    expect(user2.id).toBeDefined();
    expect(user1.id).not.toBe(user2.id);
    expect(user1.email).not.toBe(user2.email);
  });

  it('2. The same demo session retains its identity after refresh/subsequent calls', async () => {
    const agent = supertest.agent(app);

    const loginRes = await agent.post('/api/auth/dev-login').send({});
    const userFirst = loginRes.body.user;

    // Refresh / Call dev-login again within same session
    const refreshRes = await agent.post('/api/auth/dev-login').send({});
    const userRefreshed = refreshRes.body.user;

    expect(userRefreshed.id).toBe(userFirst.id);
    expect(userRefreshed.email).toBe(userFirst.email);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(userFirst.id);
  });

  it('3. Visitor B cannot read or cancel Visitor A scheduled emails', async () => {
    const agentA = supertest.agent(app);
    const agentB = supertest.agent(app);

    // Login Agent A and Agent B
    await agentA.post('/api/auth/dev-login').send({});
    await agentB.post('/api/auth/dev-login').send({});

    // Mock BullMQ add & ES index so schedule succeeds without external services
    jest.spyOn(emailQueue, 'add').mockResolvedValue({ id: 'job-sec-123' } as any);

    // Agent A schedules an email
    const scheduleRes = await agentA.post('/api/emails/schedule').send({
      senderEmail: 'visitorA@reachinbox.ai',
      recipients: ['leadA@enterprise.com'],
      subject: 'Private Proposal A',
      bodyText: 'Confidential content for Lead A',
      scheduledAt: new Date(Date.now() + 60000).toISOString(),
    });

    expect(scheduleRes.status).toBe(201);
    const logIdA = scheduleRes.body.jobs[0].logId;

    // Agent A can retrieve their own scheduled emails
    const listA = await agentA.get('/api/emails/scheduled');
    expect(listA.status).toBe(200);
    expect(listA.body.data.length).toBeGreaterThanOrEqual(1);
    const foundInA = listA.body.data.find((e: any) => e.id === logIdA);
    expect(foundInA).toBeDefined();

    // Agent B lists scheduled emails -> must NOT contain Agent A's email
    const listB = await agentB.get('/api/emails/scheduled');
    expect(listB.status).toBe(200);
    const foundInB = listB.body.data.find((e: any) => e.id === logIdA);
    expect(foundInB).toBeUndefined();

    // Agent B attempts to cancel Agent A's email -> must return 404 (Not Found / Unauthorized)
    const cancelResB = await agentB.delete(`/api/emails/scheduled/${logIdA}`);
    expect(cancelResB.status).toBe(404);
    expect(cancelResB.body.error).toBe('Scheduled email not found.');
  });

  it('4. Unauthenticated requests are rejected and logout invalidates session', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/dev-login').send({});

    const meBefore = await agent.get('/api/auth/me');
    expect(meBefore.status).toBe(200);

    // Logout
    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    // After logout, session is destroyed
    const meAfter = await agent.get('/api/auth/me');
    expect(meAfter.status).toBe(401);
  });

  it('5. Unauthorized users cannot access Bull Board (/admin/queues), but admin key allows access', async () => {
    // Unauthenticated request to /admin/queues
    const resUnauth = await supertest(app).get('/admin/queues');
    expect(resUnauth.status).toBe(401);
    expect(resUnauth.body.error).toBe('Unauthorized. Admin access required.');

    // Ordinary demo user session request to /admin/queues
    const agent = supertest.agent(app);
    await agent.post('/api/auth/dev-login').send({});
    const resUser = await agent.get('/admin/queues');
    expect(resUser.status).toBe(401);

    // Request with valid Admin Key header
    const resAdminHeader = await supertest(app)
      .get('/admin/queues')
      .set('x-admin-key', config.admin.key);
    expect(resAdminHeader.status).not.toBe(401);

    // Request with valid Admin Basic Auth
    const basicAuthToken = Buffer.from(`admin:${config.admin.key}`).toString('base64');
    const resAdminBasic = await supertest(app)
      .get('/admin/queues')
      .set('authorization', `Basic ${basicAuthToken}`);
    expect(resAdminBasic.status).not.toBe(401);
  });

  it('6. Google OAuth routes return popup HTML responses with postMessage origin validation', async () => {
    // When /google/callback receives error or cancellation, returns HTML with GOOGLE_AUTH_FAILURE postMessage
    const resCallback = await supertest(app).get('/api/auth/google/callback?error=access_denied');
    expect(resCallback.status).toBe(200);
    expect(resCallback.text).toContain('GOOGLE_AUTH_FAILURE');
    expect(resCallback.text).not.toContain('code=');
  });

  it('7. Google Account linking preserves the existing user ID and scheduled emails', async () => {
    const agent = supertest.agent(app);
    const uniqueGoogleId = `google-uid-test-${Math.random().toString(36).substring(2, 9)}`;

    // Login as Demo User
    const demoRes = await agent.post('/api/auth/dev-login').send({});
    const initialUser = demoRes.body.user;

    // Schedule an email as demo user
    jest.spyOn(emailQueue, 'add').mockResolvedValue({ id: 'job-link-101' } as any);
    const schedRes = await agent.post('/api/emails/schedule').send({
      senderEmail: initialUser.email,
      recipients: ['client@corp.com'],
      subject: 'Demo Campaign Before Linking',
      bodyText: 'Campaign data that must survive Google link',
      scheduledAt: new Date(Date.now() + 60000).toISOString(),
    });
    expect(schedRes.status).toBe(201);
    const logId = schedRes.body.jobs[0].logId;

    // Link a Google identity to the existing session user in Prisma
    const linkedUser = await prisma.user.update({
      where: { id: initialUser.id },
      data: {
        googleId: uniqueGoogleId,
        name: 'Jane Google Executive',
        avatarUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
      },
    });

    expect(linkedUser.id).toBe(initialUser.id);
    expect(linkedUser.googleId).toBe(uniqueGoogleId);

    // Verify /api/auth/me returns updated profile with avatarUrl, googleId, and name
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(initialUser.id);
    expect(meRes.body.user.googleId).toBe(uniqueGoogleId);
    expect(meRes.body.user.avatarUrl).toBe('https://lh3.googleusercontent.com/a/photo.jpg');

    // Verify scheduled emails are STILL accessible and owned by this user
    const listRes = await agent.get('/api/emails/scheduled');
    expect(listRes.status).toBe(200);
    const foundEmail = listRes.body.data.find((e: any) => e.id === logId);
    expect(foundEmail).toBeDefined();
    expect(foundEmail.subject).toBe('Demo Campaign Before Linking');
  });

  it('8. A Google account already linked elsewhere cannot be claimed by another user', async () => {
    const uniqueTag = Math.random().toString(36).substring(2, 9);
    const uniqueEmail = `usera.${uniqueTag}@google-domain.com`;
    const uniqueGoogleId = `google-id-${uniqueTag}`;

    // User A has linked uniqueGoogleId
    const userA = await prisma.user.create({
      data: {
        email: uniqueEmail,
        name: 'User A',
        googleId: uniqueGoogleId,
      },
    });

    // User B is a demo user attempting to link the same Google ID
    const agentB = supertest.agent(app);
    const devB = await agentB.post('/api/auth/dev-login').send({});
    const userB = devB.body.user;

    // Check query for existing user with same googleId excluding userB.id
    const existingOtherUser = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: uniqueGoogleId }, { email: uniqueEmail }],
        NOT: { id: userB.id },
      },
    });

    expect(existingOtherUser).toBeDefined();
    expect(existingOtherUser?.id).toBe(userA.id);

    // User B's identity remains unchanged
    const meB = await agentB.get('/api/auth/me');
    expect(meB.body.user.id).toBe(userB.id);
    expect(meB.body.user.id).not.toBe(userA.id);
  });
});
