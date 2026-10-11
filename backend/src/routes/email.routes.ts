import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { scheduleEmailJob, emailQueue } from '../lib/queue';
import { searchEmailsInES, indexEmailRecord } from '../lib/elasticsearch';
import { getCurrentHourlyCount } from '../lib/rateLimiter';
import { parseKolkataLocalToUTC } from '../lib/timezone';

const router = Router();

// Zod Schema for Scheduling Emails
const ScheduleEmailSchema = z.object({
  senderEmail: z.string().email(),
  recipients: z.array(z.string().email()).min(1, 'At least one valid recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  bodyText: z.string().min(1, 'Body is required'),
  scheduledAt: z.string().min(1, 'scheduledAt is required'),
  delayBetweenSendsMs: z.number().int().nonnegative().optional().default(2000),
  hourlyLimit: z.number().int().positive().optional().default(50),
});

// 1. Schedule Emails Endpoint
router.post('/schedule', requireAuth, async (req: Request, res: Response) => {
  let createdBatchId: string | null = null;
  const addedJobIds: string[] = [];

  try {
    const validatedData = ScheduleEmailSchema.parse(req.body);
    const userId = req.user!.id;

    const scheduledDate = parseKolkataLocalToUTC(validatedData.scheduledAt);
    const now = Date.now();
    const baseDelayMs = Math.max(0, scheduledDate.getTime() - now);

    // Transactionally create Batch & Recipient Logs in DB
    const { batch, recipientLogs } = await prisma.$transaction(async (tx) => {
      const batchRecord = await tx.scheduledEmailBatch.create({
        data: {
          userId,
          senderEmail: validatedData.senderEmail,
          subject: validatedData.subject,
          bodyText: validatedData.bodyText,
          scheduledAt: scheduledDate,
          delayBetweenSendsMs: validatedData.delayBetweenSendsMs,
          hourlyLimit: validatedData.hourlyLimit,
          totalRecipients: validatedData.recipients.length,
          status: 'SCHEDULED',
        },
      });

      const logs = [];
      for (let i = 0; i < validatedData.recipients.length; i++) {
        const recipientEmail = validatedData.recipients[i];
        const recipientDelayMs = baseDelayMs + i * validatedData.delayBetweenSendsMs;
        const recipientScheduledAt = new Date(now + recipientDelayMs);

        const logRecord = await tx.emailRecipientLog.create({
          data: {
            batchId: batchRecord.id,
            recipientEmail,
            status: 'SCHEDULED',
            scheduledAt: recipientScheduledAt,
          },
        });

        const jobId = `email-${logRecord.id}`;
        const updatedLog = await tx.emailRecipientLog.update({
          where: { id: logRecord.id },
          data: { jobId },
        });

        logs.push({
          log: updatedLog,
          jobId,
          recipientDelayMs,
          recipientScheduledAt,
          recipientIndex: i,
        });
      }

      return { batch: batchRecord, recipientLogs: logs };
    });

    createdBatchId = batch.id;
    const scheduledJobsInfo = [];

    // Schedule BullMQ jobs & index initial status in ES
    for (const item of recipientLogs) {
      const { log, jobId, recipientDelayMs, recipientScheduledAt, recipientIndex } = item;

      await emailQueue.add(
        'send-email',
        {
          logId: log.id,
          batchId: batch.id,
          userId,
          senderEmail: validatedData.senderEmail,
          recipientEmail: log.recipientEmail,
          subject: validatedData.subject,
          bodyText: validatedData.bodyText,
          hourlyLimit: validatedData.hourlyLimit,
          delayBetweenSendsMs: validatedData.delayBetweenSendsMs,
          recipientIndex,
        },
        {
          jobId,
          delay: Math.max(0, recipientDelayMs),
        }
      );

      addedJobIds.push(jobId);

      // Index in Elasticsearch (safely handled internally)
      await indexEmailRecord({
        logId: log.id,
        batchId: batch.id,
        userId,
        senderEmail: validatedData.senderEmail,
        recipientEmail: log.recipientEmail,
        subject: validatedData.subject,
        bodyText: validatedData.bodyText,
        status: 'SCHEDULED',
        scheduledAt: recipientScheduledAt,
      });

      scheduledJobsInfo.push({
        logId: log.id,
        jobId,
        recipientEmail: log.recipientEmail,
        scheduledAt: recipientScheduledAt,
      });
    }

    return res.status(201).json({
      message: 'Emails scheduled successfully',
      batchId: batch.id,
      totalScheduled: validatedData.recipients.length,
      scheduledAt: scheduledDate,
      jobs: scheduledJobsInfo,
    });
  } catch (error: any) {
    // Remove queued jobs if queue scheduling failed
    if (addedJobIds.length > 0) {
      for (const jId of addedJobIds) {
        try {
          const j = await emailQueue.getJob(jId);
          if (j) await j.remove();
        } catch (_) {}
      }
    }

    // Delete DB batch (cascade deletes recipient logs) to prevent orphaned partial records
    if (createdBatchId) {
      try {
        await prisma.scheduledEmailBatch.delete({
          where: { id: createdBatchId },
        });
      } catch (_) {}
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }

    console.error('[Schedule Route Exception]', {
      message: error?.message || String(error),
      name: error?.name,
      stack: error?.stack,
      code: error?.code,
    });

    return res.status(500).json({
      error: 'Failed to schedule emails.',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

// 2. Get Scheduled Emails List
router.get('/scheduled', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const statusFilter = req.query.status as string;

    const whereClause: any = {
      batch: { userId },
      status: statusFilter ? statusFilter : { in: ['SCHEDULED', 'PROCESSING', 'RESCHEDULED'] },
    };

    const [logs, total] = await Promise.all([
      prisma.emailRecipientLog.findMany({
        where: whereClause,
        include: {
          batch: {
            select: {
              senderEmail: true,
              subject: true,
              bodyText: true,
              hourlyLimit: true,
              delayBetweenSendsMs: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailRecipientLog.count({ where: whereClause }),
    ]);

    res.json({
      data: logs.map((log) => ({
        id: log.id,
        batchId: log.batchId,
        senderEmail: log.batch.senderEmail,
        recipientEmail: log.recipientEmail,
        subject: log.batch.subject,
        bodyText: log.batch.bodyText,
        status: log.status,
        scheduledAt: log.scheduledAt,
        jobId: log.jobId,
        lastError: log.lastError,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Get Scheduled Error]', error);
    res.status(500).json({ error: 'Failed to fetch scheduled emails.' });
  }
});

// 3. Get Sent / Failed Emails List
router.get('/sent', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const statusFilter = req.query.status as string;

    const whereClause: any = {
      batch: { userId },
      status: statusFilter ? statusFilter : { in: ['SENT', 'FAILED', 'COMPLETED'] },
    };

    const [logs, total] = await Promise.all([
      prisma.emailRecipientLog.findMany({
        where: whereClause,
        include: {
          batch: {
            select: {
              senderEmail: true,
              subject: true,
              bodyText: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailRecipientLog.count({ where: whereClause }),
    ]);

    res.json({
      data: logs.map((log) => ({
        id: log.id,
        batchId: log.batchId,
        senderEmail: log.batch.senderEmail,
        recipientEmail: log.recipientEmail,
        subject: log.batch.subject,
        bodyText: log.batch.bodyText,
        status: log.status,
        sentAt: log.sentAt || log.updatedAt,
        etherealPreviewUrl: log.etherealPreviewUrl,
        attempts: log.attempts,
        lastError: log.lastError,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Get Sent Error]', error);
    res.status(500).json({ error: 'Failed to fetch sent emails.' });
  }
});

// 4. Overall Dashboard Statistics
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [scheduledCount, processingCount, sentCount, failedCount, userBatches] = await Promise.all([
      prisma.emailRecipientLog.count({
        where: { batch: { userId }, status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
      }),
      prisma.emailRecipientLog.count({
        where: { batch: { userId }, status: 'PROCESSING' },
      }),
      prisma.emailRecipientLog.count({
        where: { batch: { userId }, status: 'SENT' },
      }),
      prisma.emailRecipientLog.count({
        where: { batch: { userId }, status: 'FAILED' },
      }),
      prisma.scheduledEmailBatch.findMany({
        where: { userId },
        select: { senderEmail: true },
        distinct: ['senderEmail'],
      }),
    ]);

    let currentHourlySendCount = 0;
    for (const b of userBatches) {
      const c = await getCurrentHourlyCount(b.senderEmail);
      currentHourlySendCount += c;
    }

    res.json({
      scheduled: scheduledCount,
      processing: processingCount,
      sent: sentCount,
      failed: failedCount,
      total: scheduledCount + processingCount + sentCount + failedCount,
      currentHourlyRate: currentHourlySendCount,
    });
  } catch (error) {
    console.error('[Get Stats Error]', error);
    res.status(500).json({ error: 'Failed to compute dashboard stats.' });
  }
});

// 5. Elasticsearch Search Endpoint
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const queryText = (req.query.q as string) || '';

    if (!queryText.trim()) {
      return res.json({ data: [] });
    }

    const searchResults = await searchEmailsInES(userId, queryText);
    res.json({ data: searchResults });
  } catch (error) {
    console.error('[Search Route Error]', error);
    res.status(500).json({ error: 'Search execution failed.' });
  }
});

// 6. Cancel Scheduled Email Job
router.delete('/scheduled/:logId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { logId } = req.params;

    const log = await prisma.emailRecipientLog.findFirst({
      where: {
        id: logId,
        batch: { userId },
      },
    });

    if (!log) {
      return res.status(404).json({ error: 'Scheduled email not found.' });
    }

    // Remove from BullMQ queue if jobId exists
    if (log.jobId) {
      const job = await emailQueue.getJob(log.jobId);
      if (job) {
        await job.remove();
      }
    }

    // Update status in DB
    await prisma.emailRecipientLog.update({
      where: { id: logId },
      data: { status: 'CANCELLED' },
    });

    // Update Elasticsearch
    await indexEmailRecord({
      logId: log.id,
      batchId: log.batchId,
      userId,
      senderEmail: 'cancelled@reachinbox.ai',
      recipientEmail: log.recipientEmail,
      subject: 'Cancelled',
      bodyText: '',
      status: 'CANCELLED',
      scheduledAt: log.scheduledAt,
    });

    res.json({ message: 'Scheduled email job cancelled successfully.' });
  } catch (error) {
    console.error('[Cancel Route Error]', error);
    res.status(500).json({ error: 'Failed to cancel email job.' });
  }
});

export default router;
