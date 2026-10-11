import { Worker, Job } from 'bullmq';
import { redisOptions } from './lib/redis';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from './lib/queue';
import { checkAndIncrementHourlyLimit } from './lib/rateLimiter';
import { sendSlackRateLimitNotification } from './lib/slack';
import { sendEmail } from './lib/mailer';
import { indexEmailRecord } from './lib/elasticsearch';
import prisma from './lib/prisma';
import { config } from './config';

console.log(`[Worker] Starting ReachInbox Email Worker with concurrency: ${config.worker.concurrency}...`);

// Helper sleep function
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Keep track of Slack notification throttles per sender per hour so we don't spam Slack
const notifiedSendersThisHour = new Set<string>();

export const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const {
      logId,
      batchId,
      userId,
      senderEmail,
      recipientEmail,
      subject,
      bodyText,
      hourlyLimit,
      delayBetweenSendsMs,
    } = job.data;

    console.log(`[Worker] Processing email job ${job.id} for ${recipientEmail} from ${senderEmail}`);

    // Check rate limit atomically
    const rateCheck = await checkAndIncrementHourlyLimit(senderEmail, hourlyLimit);

    if (!rateCheck.allowed) {
      console.warn(
        `[Worker Rate Limit] Sender ${senderEmail} exceeded hourly limit (${hourlyLimit}/hr). Rescheduling job ${job.id} in ${Math.round(rateCheck.resetMs / 1000)}s.`
      );

      // Trigger Slack notification once per window for this sender
      const hourBucketKey = `${senderEmail}:${rateCheck.windowStart}`;
      if (!notifiedSendersThisHour.has(hourBucketKey)) {
        notifiedSendersThisHour.add(hourBucketKey);
        await sendSlackRateLimitNotification(
          userId,
          senderEmail,
          hourlyLimit,
          rateCheck.resetMs
        );
      }

      // Update log status to RESCHEDULED
      const newScheduledAt = new Date(Date.now() + rateCheck.resetMs);
      await prisma.emailRecipientLog.update({
        where: { id: logId },
        data: {
          status: 'RESCHEDULED',
          scheduledAt: newScheduledAt,
          lastError: `Rate limit hit (${hourlyLimit} emails/hr). Delayed by ${Math.round(rateCheck.resetMs / 60000)}m.`,
        },
      });

      // Reschedule in BullMQ for next window
      await emailQueue.add('send-email', job.data, {
        jobId: `email-${logId}-rescheduled-${Date.now()}`,
        delay: rateCheck.resetMs,
      });

      return { status: 'RESCHEDULED', delayMs: rateCheck.resetMs };
    }

    // Rate limit OK -> Mark status as PROCESSING
    await prisma.emailRecipientLog.update({
      where: { id: logId },
      data: { status: 'PROCESSING' },
    });

    // Enforce configured minimum delay between sends
    if (delayBetweenSendsMs > 0) {
      await sleep(delayBetweenSendsMs);
    }

    try {
      // Send actual email via Nodemailer (Ethereal SMTP)
      const sendResult = await sendEmail({
        senderEmail,
        recipientEmail,
        subject,
        bodyText,
      });

      const sentAt = new Date();

      // Update recipient log in DB
      await prisma.emailRecipientLog.update({
        where: { id: logId },
        data: {
          status: 'SENT',
          sentAt,
          etherealPreviewUrl: sendResult.etherealPreviewUrl || null,
        },
      });

      // Increment batch sent count
      const updatedBatch = await prisma.scheduledEmailBatch.update({
        where: { id: batchId },
        data: { sentCount: { increment: 1 } },
      });

      // Update batch status to COMPLETED if all sent/failed
      if (updatedBatch.sentCount + updatedBatch.failedCount >= updatedBatch.totalRecipients) {
        await prisma.scheduledEmailBatch.update({
          where: { id: batchId },
          data: { status: 'COMPLETED' },
        });
      }

      // Index email in Elasticsearch
      await indexEmailRecord({
        logId,
        batchId,
        userId,
        senderEmail,
        recipientEmail,
        subject,
        bodyText,
        status: 'SENT',
        etherealPreviewUrl: sendResult.etherealPreviewUrl || null,
        scheduledAt: job.timestamp ? new Date(job.timestamp) : new Date(),
        sentAt,
      });

      console.log(`[Worker] Successfully sent email ${logId} to ${recipientEmail}. Preview: ${sendResult.etherealPreviewUrl}`);

      return {
        status: 'SENT',
        messageId: sendResult.messageId,
        previewUrl: sendResult.etherealPreviewUrl,
      };
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to send email';
      console.error(`[Worker Email Failed] ${logId} to ${recipientEmail}:`, errorMessage);

      await prisma.emailRecipientLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          lastError: errorMessage,
          attempts: { increment: 1 },
        },
      });

      const updatedBatch = await prisma.scheduledEmailBatch.update({
        where: { id: batchId },
        data: { failedCount: { increment: 1 } },
      });

      if (updatedBatch.sentCount + updatedBatch.failedCount >= updatedBatch.totalRecipients) {
        await prisma.scheduledEmailBatch.update({
          where: { id: batchId },
          data: { status: 'COMPLETED' },
        });
      }

      // Index failure in ES
      await indexEmailRecord({
        logId,
        batchId,
        userId,
        senderEmail,
        recipientEmail,
        subject,
        bodyText,
        status: 'FAILED',
        scheduledAt: job.timestamp ? new Date(job.timestamp) : new Date(),
      });

      throw error;
    }
  },
  {
    connection: redisOptions,
    concurrency: config.worker.concurrency,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker Job Completed] ID: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker Job Failed] ID: ${job?.id}, Error:`, err.message);
});
