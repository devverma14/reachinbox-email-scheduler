import { Client } from '@elastic/elasticsearch';
import { EmailRecipientLog, ScheduledEmailBatch } from '@prisma/client';
import { config } from '../config';
import prisma from './prisma';

export const esClient = new Client({
  node: config.elasticsearch.node,
});

export const EMAIL_INDEX = 'reachinbox_emails';

export async function initElasticsearchIndex() {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            logId: { type: 'keyword' },
            batchId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            bodyText: { type: 'text' },
            status: { type: 'keyword' },
            etherealPreviewUrl: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Index '${EMAIL_INDEX}' created successfully.`);
    }
  } catch (error) {
    console.warn('[Elasticsearch] Could not initialize index (Elasticsearch service might be offline or starting):', (error as Error).message);
  }
}

export interface EmailDocument {
  logId: string;
  batchId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: string;
  etherealPreviewUrl?: string | null;
  scheduledAt: Date | string;
  sentAt?: Date | string | null;
}

export async function indexEmailRecord(doc: EmailDocument): Promise<void> {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: doc.logId,
      document: {
        ...doc,
        scheduledAt: new Date(doc.scheduledAt).toISOString(),
        sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
      },
    });
  } catch (error) {
    console.warn(`[Elasticsearch] Failed to index document ${doc.logId}:`, (error as Error).message);
  }
}

export async function searchEmailsInES(userId: string, queryText: string) {
  try {
    const response = await esClient.search({
      index: EMAIL_INDEX,
      query: {
        bool: {
          must: [
            { term: { userId } },
            {
              multi_match: {
                query: queryText,
                fields: ['subject^3', 'bodyText^2', 'recipientEmail^4'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
      size: 50,
    });

    return response.hits.hits.map((hit) => hit._source);
  } catch (error) {
    console.warn('[Elasticsearch] Search query failed, falling back to PostgreSQL search:', (error as Error).message);
    
    // Fallback search in Postgres
    type FallbackRecipientLog = EmailRecipientLog & {
      batch: ScheduledEmailBatch;
    };

    const fallbackResults = await prisma.emailRecipientLog.findMany({
      where: {
        batch: { userId },
        OR: [
          { recipientEmail: { contains: queryText, mode: 'insensitive' } },
          { batch: { subject: { contains: queryText, mode: 'insensitive' } } },
          { batch: { bodyText: { contains: queryText, mode: 'insensitive' } } },
        ],
      },
      include: {
        batch: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return fallbackResults.map((r: FallbackRecipientLog) => ({
      logId: r.id,
      batchId: r.batchId,
      userId: r.batch.userId,
      senderEmail: r.batch.senderEmail,
      recipientEmail: r.recipientEmail,
      subject: r.batch.subject,
      bodyText: r.batch.bodyText,
      status: r.status,
      etherealPreviewUrl: r.etherealPreviewUrl,
      scheduledAt: r.scheduledAt,
      sentAt: r.sentAt,
    }));
  }
}
