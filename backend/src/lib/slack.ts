import { WebClient } from '@slack/web-api';
import prisma from './prisma';

export async function sendSlackRateLimitNotification(
  userId: string,
  senderEmail: string,
  hourlyLimit: number,
  resetMs: number
): Promise<boolean> {
  try {
    const slackAccount = await prisma.slackAccount.findUnique({
      where: { userId },
    });

    if (!slackAccount || !slackAccount.accessToken) {
      console.log(`[Slack] No connected Slack account for user ${userId}. Skipping notification.`);
      return false;
    }

    const client = new WebClient(slackAccount.accessToken);
    const targetChannel = slackAccount.channelId || 'general';

    const resetMinutes = Math.ceil(resetMs / (60 * 1000));
    const messageText = `⚠️ *ReachInbox Rate Limit Reached*\nSender \`${senderEmail}\` has hit the hourly limit of *${hourlyLimit} emails/hour*.\nRemaining scheduled emails have been automatically delayed by *${resetMinutes} minutes* to the next eligible window.`;

    await client.chat.postMessage({
      channel: targetChannel,
      text: messageText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *ReachInbox Sending Rate Limit Warning*`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${senderEmail}`,
            },
            {
              type: 'mrkdwn',
              text: `*Configured Limit:*\n${hourlyLimit} emails / hr`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\nRescheduled`,
            },
            {
              type: 'mrkdwn',
              text: `*Reschedule Delay:*\n~${resetMinutes} min`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⚡ ReachInbox Automatic Queue & Rate Limit Protection',
            },
          ],
        },
      ],
    });

    console.log(`[Slack] Rate limit notification sent successfully to channel ${targetChannel}`);
    return true;
  } catch (error) {
    console.error('[Slack Notification Error]', error);
    return false;
  }
}
