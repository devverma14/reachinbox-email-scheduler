import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';
import express, { Request, Response, NextFunction } from 'express';
import supertest from 'supertest';
import prisma from '../lib/prisma';
import { emailQueue } from '../lib/queue';
import { redisClient } from '../lib/redis';
import * as elasticsearch from '../lib/elasticsearch';

// Mock auth middleware
jest.mock('../middleware/auth.middleware', () => ({
  __esModule: true,
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: 'user-123', email: 'sender@reachinbox.ai' };
    next();
  },
}));

import emailRoutes from '../routes/email.routes';

const app = express();
app.use(express.json());
app.use('/api/emails', emailRoutes);

describe('Email Scheduling API Routes', () => {
  const mockBatch = {
    id: 'batch-uuid-123',
    userId: 'user-123',
    senderEmail: 'sender@reachinbox.ai',
    subject: 'Weekly Newsletter',
    bodyText: 'Check out our product updates!',
    scheduledAt: new Date(),
    delayBetweenSendsMs: 1000,
    hourlyLimit: 100,
    status: 'SCHEDULED',
    totalRecipients: 1,
    sentCount: 0,
    failedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLog = {
    id: 'log-uuid-456',
    batchId: 'batch-uuid-123',
    recipientEmail: 'recipient@domain.com',
    status: 'SCHEDULED',
    jobId: 'email-log-uuid-456',
    scheduledAt: new Date(),
    sentAt: null,
    etherealPreviewUrl: null,
    attempts: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(elasticsearch, 'indexEmailRecord').mockResolvedValue(undefined as any);

    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        scheduledEmailBatch: {
          create: jest.fn<any>().mockResolvedValue(mockBatch),
        },
        emailRecipientLog: {
          create: jest.fn<any>().mockResolvedValue(mockLog),
          update: jest.fn<any>().mockResolvedValue(mockLog),
        },
      };
      return await cb(txMock);
    });

    jest.spyOn(prisma.scheduledEmailBatch, 'delete').mockResolvedValue(mockBatch as any);
  });

  afterAll(async () => {
    try {
      await emailQueue.close();
      redisClient.disconnect();
    } catch (_) {}
  });

  it('should return 400 if validation fails (empty recipients or missing subject)', async () => {
    const res = await supertest(app)
      .post('/api/emails/schedule')
      .send({
        senderEmail: 'sender@reachinbox.ai',
        recipients: [],
        subject: '',
        bodyText: 'Hello',
        scheduledAt: new Date().toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should successfully schedule emails transactionally with colon-free BullMQ job ID', async () => {
    const queueAddSpy = jest.spyOn(emailQueue, 'add').mockResolvedValue({ id: 'email-log-uuid-456' } as any);

    const res = await supertest(app)
      .post('/api/emails/schedule')
      .send({
        senderEmail: 'sender@reachinbox.ai',
        recipients: ['recipient@domain.com'],
        subject: 'Weekly Newsletter',
        bodyText: 'Check out our product updates!',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
        delayBetweenSendsMs: 1000,
        hourlyLimit: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Emails scheduled successfully');
    expect(res.body.batchId).toBe('batch-uuid-123');
    expect(res.body.totalScheduled).toBe(1);
    expect(queueAddSpy).toHaveBeenCalledTimes(1);

    // Regression check: verify job ID passed to BullMQ does not contain colons
    const jobOptionsPassed = queueAddSpy.mock.calls[0][2];
    expect(jobOptionsPassed?.jobId).toBe('email-log-uuid-456');
    expect(jobOptionsPassed?.jobId).not.toContain(':');
  });

  it('should clean up database batch records and return 500 when queue scheduling fails', async () => {
    jest.spyOn(emailQueue, 'add').mockRejectedValueOnce(new Error('Redis connection lost') as any);
    const deleteSpy = jest.spyOn(prisma.scheduledEmailBatch, 'delete').mockResolvedValue(mockBatch as any);

    const res = await supertest(app)
      .post('/api/emails/schedule')
      .send({
        senderEmail: 'sender@reachinbox.ai',
        recipients: ['recipient@domain.com'],
        subject: 'Campaign Test',
        bodyText: 'Testing error cleanup',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to schedule emails.');
    expect(deleteSpy).toHaveBeenCalledWith({
      where: { id: 'batch-uuid-123' },
    });
  });
});
