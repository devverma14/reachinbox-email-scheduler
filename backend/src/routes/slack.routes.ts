import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { sendSlackRateLimitNotification } from '../lib/slack';

const router = Router();

// Get Slack Connection Status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const slackAccount = await prisma.slackAccount.findUnique({
    where: { userId },
  });

  res.json({
    connected: !!slackAccount,
    account: slackAccount
      ? {
          teamId: slackAccount.teamId,
          teamName: slackAccount.teamName,
          channelId: slackAccount.channelId,
          channelName: slackAccount.channelName,
          createdAt: slackAccount.createdAt,
        }
      : null,
  });
});

// Send Test Slack Notification
router.post('/test-notification', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { senderEmail } = req.body;

  const success = await sendSlackRateLimitNotification(
    userId,
    senderEmail || 'test-sender@reachinbox.ai',
    50,
    300000 // 5 minutes
  );

  if (success) {
    res.json({ message: 'Test notification sent to Slack successfully!' });
  } else {
    res.status(400).json({
      error: 'Could not send test notification.',
      message: 'Please ensure Slack is connected first or check your webhook/token settings.',
    });
  }
});

export default router;
