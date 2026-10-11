-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "googleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "botUserId" TEXT,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledEmailBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "delayBetweenSendsMs" INTEGER NOT NULL DEFAULT 2000,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledEmailBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRecipientLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "jobId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "etherealPreviewUrl" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRecipientLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackAccount_userId_key" ON "SlackAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailRecipientLog_jobId_key" ON "EmailRecipientLog"("jobId");

-- CreateIndex
CREATE INDEX "EmailRecipientLog_batchId_idx" ON "EmailRecipientLog"("batchId");

-- CreateIndex
CREATE INDEX "EmailRecipientLog_status_idx" ON "EmailRecipientLog"("status");

-- CreateIndex
CREATE INDEX "EmailRecipientLog_recipientEmail_idx" ON "EmailRecipientLog"("recipientEmail");

-- AddForeignKey
ALTER TABLE "SlackAccount" ADD CONSTRAINT "SlackAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEmailBatch" ADD CONSTRAINT "ScheduledEmailBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRecipientLog" ADD CONSTRAINT "EmailRecipientLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ScheduledEmailBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
