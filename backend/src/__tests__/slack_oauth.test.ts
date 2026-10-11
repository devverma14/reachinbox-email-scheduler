import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import supertest from 'supertest';
import { WebClient } from '@slack/web-api';
import app from '../index';
import prisma from '../lib/prisma';
import { emailQueue } from '../lib/queue';
import { redisClient } from '../lib/redis';
import { config } from '../config';

describe('Slack OAuth State Validation & Account Isolation Tests', () => {
  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    try {
      await emailQueue.close();
      redisClient.disconnect();
    } catch (_) {}
  });

  it('1. Rejects unauthenticated calls to initiate Slack OAuth', async () => {
    const res = await supertest(app).get('/api/auth/slack/authorize');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized/i);
  });

  it('2. Authenticated user receives OAuth URL with secure, random 64-char hex state', async () => {
    const agent = supertest.agent(app);
    const loginRes = await agent.post('/api/auth/dev-login').send({});
    expect(loginRes.status).toBe(200);
    const userId = loginRes.body.user.id;

    // Ensure config has client ID for test
    const origClientId = config.slack.clientId;
    config.slack.clientId = 'test-client-id-12345';

    try {
      const authRes = await agent.get('/api/auth/slack/authorize');
      expect(authRes.status).toBe(200);
      expect(authRes.body.url).toBeDefined();

      const authUrl = new URL(authRes.body.url);
      const stateParam = authUrl.searchParams.get('state');

      expect(stateParam).toBeDefined();
      expect(stateParam).not.toBeNull();
      // Must be a 32-byte hex string (64 characters)
      expect(stateParam).toMatch(/^[a-f0-9]{64}$/);
      // Must NOT be the raw user ID
      expect(stateParam).not.toBe(userId);
    } finally {
      config.slack.clientId = origClientId;
    }
  });

  it('3. Callback rejects missing code or missing state', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/dev-login').send({});

    // Missing code and state
    const res1 = await agent.get('/api/auth/slack/callback');
    expect(res1.status).toBe(302);
    expect(res1.headers.location).toContain('slack_error=missing_code_or_state');

    // Missing state
    const res2 = await agent.get('/api/auth/slack/callback?code=mock_code');
    expect(res2.status).toBe(302);
    expect(res2.headers.location).toContain('slack_error=missing_code_or_state');

    // Missing code
    const res3 = await agent.get('/api/auth/slack/callback?state=random_state');
    expect(res3.status).toBe(302);
    expect(res3.headers.location).toContain('slack_error=missing_code_or_state');
  });

  it('4. Callback rejects mismatched or forged state', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/dev-login').send({});

    const origClientId = config.slack.clientId;
    config.slack.clientId = 'test-client-id-12345';

    try {
      // Initiate OAuth
      await agent.get('/api/auth/slack/authorize');

      // Attempt callback with a forged state
      const forgedState = '0000000000000000000000000000000000000000000000000000000000000000';
      const callbackRes = await agent.get(`/api/auth/slack/callback?code=valid_code&state=${forgedState}`);
      expect(callbackRes.status).toBe(302);
      expect(callbackRes.headers.location).toContain('slack_error=invalid_state');
    } finally {
      config.slack.clientId = origClientId;
    }
  });

  it('5. User isolation: Attacker cannot link Slack to Victim account using forged state', async () => {
    const victimAgent = supertest.agent(app);
    const attackerAgent = supertest.agent(app);

    const victimLogin = await victimAgent.post('/api/auth/dev-login').send({});
    const attackerLogin = await attackerAgent.post('/api/auth/dev-login').send({});
    const victimUser = victimLogin.body.user;
    const attackerUser = attackerLogin.body.user;

    expect(victimUser.id).not.toBe(attackerUser.id);

    const origClientId = config.slack.clientId;
    config.slack.clientId = 'test-client-id-12345';

    try {
      // Victim initiates OAuth
      const victimAuthRes = await victimAgent.get('/api/auth/slack/authorize');
      const victimUrl = new URL(victimAuthRes.body.url);
      const victimState = victimUrl.searchParams.get('state');

      // Attacker intercepts victimState and tries to call callback in Attacker session
      const attackerCallbackRes = await attackerAgent.get(`/api/auth/slack/callback?code=attacker_code&state=${victimState}`);
      expect(attackerCallbackRes.status).toBe(302);
      expect(attackerCallbackRes.headers.location).toContain('slack_error=invalid_state');

      // Attacker tries to pass victim user ID as state
      const rawIdCallback = await attackerAgent.get(`/api/auth/slack/callback?code=attacker_code&state=${victimUser.id}`);
      expect(rawIdCallback.status).toBe(302);
      expect(rawIdCallback.headers.location).toContain('slack_error=invalid_state');

      // Confirm Victim has no linked Slack account
      const victimAccount = await prisma.slackAccount.findUnique({ where: { userId: victimUser.id } });
      expect(victimAccount).toBeNull();
    } finally {
      config.slack.clientId = origClientId;
    }
  });

  it('6. Successful callback links Slack account exclusively for the authenticated initiator and prevents replay', async () => {
    const agent = supertest.agent(app);
    const loginRes = await agent.post('/api/auth/dev-login').send({});
    const user = loginRes.body.user;

    const origClientId = config.slack.clientId;
    config.slack.clientId = 'test-client-id-12345';

    // Mock WebClient.prototype.apiCall for oauth.v2.access
    jest.spyOn(WebClient.prototype as any, 'apiCall').mockImplementation(async (method: any) => {
      if (method === 'oauth.v2.access') {
        return {
          ok: true,
          access_token: 'xoxb-real-verified-token',
          bot_user_id: 'U99999999',
          team: { id: 'T99999999', name: 'ReachInbox Team' },
          incoming_webhook: { channel: '#reach-alerts', channel_id: 'C99999999' },
        };
      }
      return { ok: true };
    });

    try {
      // 1. Initiate OAuth
      const authRes = await agent.get('/api/auth/slack/authorize');
      const authUrl = new URL(authRes.body.url);
      const validState = authUrl.searchParams.get('state');

      // 2. Complete callback with valid code & matching state
      const callbackRes = await agent.get(`/api/auth/slack/callback?code=mock_auth_code_123&state=${validState}`);
      expect(callbackRes.status).toBe(302);
      expect(callbackRes.headers.location).toContain('slack_success=true');

      // 3. Verify database storage exclusively for this user
      const slackAccount = await prisma.slackAccount.findUnique({
        where: { userId: user.id },
      });
      expect(slackAccount).not.toBeNull();
      expect(slackAccount?.teamName).toBe('ReachInbox Team');
      expect(slackAccount?.channelName).toBe('#reach-alerts');
      expect(slackAccount?.channelId).toBe('C99999999');
      expect(slackAccount?.accessToken).toBe('xoxb-real-verified-token');

      // 4. Replay attack: Submitting the same state a second time must fail
      const replayRes = await agent.get(`/api/auth/slack/callback?code=replay_code&state=${validState}`);
      expect(replayRes.status).toBe(302);
      expect(replayRes.headers.location).toContain('slack_error=invalid_state');
    } finally {
      config.slack.clientId = origClientId;
    }
  });

  it('7. Preserves disconnect functionality for the authenticated user', async () => {
    const agent = supertest.agent(app);
    const loginRes = await agent.post('/api/auth/dev-login').send({});
    const user = loginRes.body.user;

    // Seed slack account
    await prisma.slackAccount.upsert({
      where: { userId: user.id },
      update: {
        accessToken: 'xoxb-temp-test',
        teamId: 'T11111111',
      },
      create: {
        userId: user.id,
        accessToken: 'xoxb-temp-test',
        teamId: 'T11111111',
      },
    });

    // Disconnect
    const disconnectRes = await agent.post('/api/auth/slack/disconnect').send({});
    expect(disconnectRes.status).toBe(200);
    expect(disconnectRes.body.message).toMatch(/disconnected successfully/i);

    const deleted = await prisma.slackAccount.findUnique({ where: { userId: user.id } });
    expect(deleted).toBeNull();
  });
});
