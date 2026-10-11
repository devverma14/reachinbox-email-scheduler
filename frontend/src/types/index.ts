export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  googleId?: string | null;
}

export interface SlackDetails {
  teamId: string;
  teamName: string | null;
  channelId: string | null;
  channelName: string | null;
  createdAt: string;
}

export interface ScheduledEmail {
  id: string;
  batchId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'RESCHEDULED' | 'CANCELLED';
  scheduledAt: string;
  jobId?: string | null;
  lastError?: string | null;
}

export interface SentEmail {
  id: string;
  batchId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: 'SENT' | 'FAILED' | 'COMPLETED';
  sentAt: string;
  etherealPreviewUrl?: string | null;
  attempts: number;
  lastError?: string | null;
}

export interface EmailStats {
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
  currentHourlyRate: number;
}

export interface SearchResult {
  logId: string;
  batchId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: string;
  etherealPreviewUrl?: string | null;
  scheduledAt: string;
  sentAt?: string | null;
}
