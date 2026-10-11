import { Queue } from 'bullmq';
import { redisOptions } from './redis';
import prisma from './prisma';

export const EMAIL_QUEUE_NAME = 'email-dispatch-queue';

export interface EmailJobData {
  logId: string;
  batchId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  hourlyLimit: number;
  delayBetweenSendsMs: number;
  recipientIndex: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { age: 86400 * 7 }, // Keep completed job logs for 7 days
    removeOnFail: { age: 86400 * 14 },
  },
});

/**
 * Schedule delayed email job in BullMQ with an idempotent Job ID
 */
export async function scheduleEmailJob(
  data: EmailJobData,
  delayMs: number
): Promise<string> {
  const jobId = `email-${data.logId}`;
  
  await emailQueue.add('send-email', data, {
    jobId,
    delay: Math.max(0, delayMs),
  });

  // Update DB log record with the job ID
  await prisma.emailRecipientLog.update({
    where: { id: data.logId },
    data: { jobId },
  });

  return jobId;
}

/**
 * Startup Reconciliation: Ensures no scheduled jobs are lost on server/worker restarts
 */
export async function reconcileOrphanedJobs(): Promise<void> {
  try {
    const pendingLogs = await prisma.emailRecipientLog.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
      },
      include: {
        batch: true,
      },
    });

    console.log(`[Queue Reconciliation] Checking ${pendingLogs.length} pending email records...`);
    let readdedCount = 0;

    for (const log of pendingLogs) {
      const jobId = log.jobId || `email-${log.id}`;
      const existingJob = await emailQueue.getJob(jobId);

      if (!existingJob) {
        const now = Date.now();
        const scheduledTime = new Date(log.scheduledAt).getTime();
        const delayMs = Math.max(0, scheduledTime - now);

        await emailQueue.add(
          'send-email',
          {
            logId: log.id,
            batchId: log.batchId,
            userId: log.batch.userId,
            senderEmail: log.batch.senderEmail,
            recipientEmail: log.recipientEmail,
            subject: log.batch.subject,
            bodyText: log.batch.bodyText,
            hourlyLimit: log.batch.hourlyLimit,
            delayBetweenSendsMs: log.batch.delayBetweenSendsMs,
            recipientIndex: 0,
          },
          {
            jobId,
            delay: delayMs,
          }
        );
        readdedCount++;
      }
    }

    if (readdedCount > 0) {
      console.log(`[Queue Reconciliation] Re-enqueued ${readdedCount} orphaned jobs after restart.`);
    }
  } catch (error) {
    console.error('[Queue Reconciliation Error]', error);
  }
}
