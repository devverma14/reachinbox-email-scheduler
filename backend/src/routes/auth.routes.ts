import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { config } from '../config';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Passport Google Strategy setup (if credentials provided)
// Passport Google Strategy setup (if credentials provided)
if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        passReqToCallback: true,
      },
      async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value || `${profile.id}@google.com`;
          const name = profile.displayName || profile.name?.givenName || 'Google User';
          const avatarUrl = profile.photos?.[0]?.value || null;

          // Check if active session user exists (Account Linking Flow)
          const currentUserId = req.session?.userId || req.user?.id;

          // Search for existing user with this googleId or email
          const existingOtherUser = await prisma.user.findFirst({
            where: {
              OR: [
                { googleId: profile.id },
                { email },
              ],
              ...(currentUserId ? { NOT: { id: currentUserId } } : {}),
            },
          });

          // Account Linking Flow: Link Google profile to current active session user
          if (currentUserId) {
            if (existingOtherUser) {
              return done(null, false, {
                message: 'This Google account is already linked to another ReachInbox user.',
              });
            }

            const updatedUser = await prisma.user.update({
              where: { id: currentUserId },
              data: {
                googleId: profile.id,
                email,
                name: name || undefined,
                avatarUrl: avatarUrl || undefined,
              },
            });

            return done(null, updatedUser);
          }

          // Direct Google Login Flow: No active session
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { googleId: profile.id },
                { email },
              ],
            },
          });

          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                email,
                name: name || user.name,
                avatarUrl: avatarUrl || user.avatarUrl,
              },
            });
          } else {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email,
                name,
                avatarUrl,
              },
            });
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// 1. Get Current User & Slack Status
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      slackAccount: {
        select: {
          teamId: true,
          teamName: true,
          channelId: true,
          channelName: true,
          createdAt: true,
        },
      },
    },
  });

  res.json({
    user: {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      avatarUrl: user?.avatarUrl,
      googleId: user?.googleId || null,
    },
    slackConnected: !!user?.slackAccount,
    slackDetails: user?.slackAccount || null,
  });
});

// 2. Dev / Demo Instant Login (Per-session isolated demo identities with persistence)
router.post('/dev-login', async (req: Request, res: Response) => {
  try {
    // Reuse existing session user if already authenticated
    const existingUserId = (req.session as any)?.userId;
    if (existingUserId) {
      const existingUser = await prisma.user.findUnique({
        where: { id: existingUserId },
      });
      if (existingUser) {
        return req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[Dev Login Error] Failed to persist existing session:', saveErr);
            return res.status(500).json({ error: 'Failed to persist session.' });
          }
          return res.json({
            message: 'Session identity restored',
            user: existingUser,
          });
        });
      }
    }

    const { email, name } = req.body;
    let userEmail = typeof email === 'string' ? email.trim() : '';

    // Safety restriction: Ensure dev-login can ONLY be used for demo accounts
    // Prevent taking over admin accounts or non-demo accounts
    if (
      userEmail &&
      (userEmail.toLowerCase() === config.admin.email.toLowerCase() ||
        !userEmail.toLowerCase().endsWith('@reachinbox.ai') ||
        !userEmail.toLowerCase().startsWith('demo.'))
    ) {
      return res.status(403).json({
        error: 'Dev login is restricted to demo accounts (@reachinbox.ai).',
      });
    }

    // Generate unique per-session demo email if none or default specified
    if (!userEmail || userEmail === 'demo.user@reachinbox.ai') {
      const uniqueSuffix = crypto.randomBytes(4).toString('hex');
      userEmail = `demo.${uniqueSuffix}@reachinbox.ai`;
    }

    const userName = name || 'Demo Executive';

    let user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    // If an existing user was found, make sure it is not an account linked with Google
    if (user && user.googleId) {
      return res.status(403).json({
        error: 'Dev login cannot access accounts linked with Google.',
      });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userName,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userEmail)}`,
        },
      });
    }

    const saveSessionAndRespond = () => {
      (req.session as any).userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Dev Login Error] Failed to persist session:', saveErr);
          return res.status(500).json({ error: 'Failed to persist session.' });
        }
        return res.json({
          message: 'Signed in successfully via Dev Mode',
          user,
        });
      });
    };

    if (typeof req.session.regenerate === 'function') {
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          console.error('[Dev Login Error] Failed to regenerate session:', regenErr);
          return res.status(500).json({ error: 'Failed to initialize session.' });
        }
        saveSessionAndRespond();
      });
    } else {
      saveSessionAndRespond();
    }
  } catch (error) {
    console.error('[Dev Login Error]', error);
    res.status(500).json({ error: 'Failed to authenticate demo session.' });
  }
});

// 3. Google OAuth Routes (Popup Auth & Callback Support)
router.get('/google', (req, res, next) => {
  if (!config.google.clientId || config.google.clientId.startsWith('mock_')) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Google OAuth Not Configured</title></head>
      <body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;padding:24px;">
          <h3 style="margin-bottom:8px;color:#f59e0b;">Google OAuth Not Configured</h3>
          <p style="color:#94a3b8;font-size:13px;max-width:320px;line-height:1.5;">
            GOOGLE_CLIENT_ID is not configured in .env.<br>Please use the <strong>Enter Demo Workspace</strong> button.
          </p>
        </div>
        <script>
          (function() {
            var targetOrigin = ${JSON.stringify(config.clientUrl)};
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_FAILURE', error: 'Google OAuth credentials not configured in .env. Please use Demo Workspace.' }, targetOrigin);
              } catch(e) {}
            }
            setTimeout(function() { window.close(); }, 2000);
          })();
        </script>
      </body>
      </html>
    `);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  const targetOrigin = config.clientUrl;

  passport.authenticate('google', (err: any, user: any, info: any) => {
    const errorMsg = info?.message || err?.message || 'Google login failed or was cancelled.';

    if (err || !user) {
      console.error('[Google OAuth Callback Error]', err || info);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:24px;">
            <h3 style="margin-bottom:8px;color:#f43f5e;">Authentication Failed</h3>
            <p style="color:#94a3b8;font-size:13px;">${errorMsg}</p>
          </div>
          <script>
            (function() {
              var targetOrigin = ${JSON.stringify(targetOrigin)};
              if (window.opener && !window.opener.closed) {
                try {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_FAILURE', error: ${JSON.stringify(errorMsg)} }, targetOrigin);
                } catch(e) {}
              }
              setTimeout(function() { window.close(); }, 1500);
            })();
          </script>
        </body>
        </html>
      `);
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('[Google OAuth Login Error]', loginErr);
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Authentication Error</title></head>
          <body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;padding:24px;">
              <h3 style="margin-bottom:8px;color:#f43f5e;">Session Error</h3>
              <p style="color:#94a3b8;font-size:13px;">Could not establish user session.</p>
            </div>
            <script>
              (function() {
                var targetOrigin = ${JSON.stringify(targetOrigin)};
                if (window.opener && !window.opener.closed) {
                  try {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_FAILURE', error: 'Could not establish user session.' }, targetOrigin);
                  } catch(e) {}
                }
                setTimeout(function() { window.close(); }, 1500);
              })();
            </script>
          </body>
          </html>
        `);
      }

      (req.session as any).userId = user.id;

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Google OAuth Error] Failed to persist session:', saveErr);
        }

        res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Authentication Successful</title></head>
          <body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;padding:24px;">
              <h3 style="margin-bottom:8px;color:#10b981;">Authentication Successful</h3>
              <p style="color:#94a3b8;font-size:13px;">Completing login...</p>
            </div>
            <script>
              (function() {
                var targetOrigin = ${JSON.stringify(targetOrigin)};
                if (window.opener && !window.opener.closed) {
                  try {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, targetOrigin);
                  } catch(e) {}
                }
                setTimeout(function() { window.close(); }, 300);
              })();
            </script>
          </body>
          </html>
        `);
      });
    });
  })(req, res, next);
});

// 4. Slack OAuth Initiate & Callback
router.get('/slack/authorize', requireAuth, (req: Request, res: Response) => {
  if (!config.slack.clientId || config.slack.clientId.startsWith('mock_')) {
    // Return friendly setup instructions if client ID is mock
    return res.status(400).json({
      error: 'Slack Client ID is not configured.',
      message: 'Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env for live Slack OAuth.',
    });
  }

  // Generate cryptographically secure random state (32 bytes hex = 64 chars)
  const state = crypto.randomBytes(32).toString('hex');

  if (!req.session) {
    return res.status(500).json({ error: 'Session store unavailable.' });
  }

  // Bind the state parameter to the authenticated session user
  (req.session as any).slackOAuthState = state;
  (req.session as any).slackOAuthUserId = req.user!.id;

  req.session.save((err) => {
    if (err) {
      console.error('[Slack Authorize Error] Failed to persist OAuth session:', err);
      return res.status(500).json({ error: 'Failed to initiate secure OAuth session.' });
    }

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=chat:write,commands,incoming-webhook&redirect_uri=${encodeURIComponent(config.slack.redirectUri)}&state=${state}`;

    res.json({ url: slackAuthUrl });
  });
});

router.get('/slack/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  // 1. Handle OAuth rejection or error from Slack
  if (error) {
    return res.redirect(`${config.clientUrl}/dashboard?slack_error=${encodeURIComponent(String(error))}`);
  }

  // 2. Reject missing code or state
  if (!code || !state || typeof state !== 'string') {
    return res.redirect(`${config.clientUrl}/dashboard?slack_error=missing_code_or_state`);
  }

  // 3. Retrieve and validate state against session-bound state
  const sessionState = (req.session as any)?.slackOAuthState;
  const sessionUserId = (req.session as any)?.slackOAuthUserId;

  // Clear single-use state immediately to prevent replay attacks
  if (req.session) {
    delete (req.session as any).slackOAuthState;
    delete (req.session as any).slackOAuthUserId;
  }

  if (!sessionState || !sessionUserId || state !== sessionState) {
    console.warn('[Slack Callback Warning] State validation failed. Possible CSRF attack or expired session.');
    return res.redirect(`${config.clientUrl}/dashboard?slack_error=invalid_state`);
  }

  try {
    // 4. Verify user existence in database for account isolation
    const userExists = await prisma.user.findUnique({
      where: { id: sessionUserId },
    });

    if (!userExists) {
      return res.redirect(`${config.clientUrl}/dashboard?slack_error=user_not_found`);
    }

    const web = new WebClient();
    const result = await web.oauth.v2.access({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code: String(code),
      redirect_uri: config.slack.redirectUri,
    });

    if (result.ok && result.access_token) {
      // Preserve authenticated user identity in session
      if (req.session) {
        (req.session as any).userId = sessionUserId;
      }

      await prisma.slackAccount.upsert({
        where: { userId: sessionUserId },
        update: {
          accessToken: result.access_token,
          botUserId: result.bot_user_id || null,
          teamId: result.team?.id || 'unknown',
          teamName: result.team?.name || 'Slack Workspace',
          channelId: (result as any).incoming_webhook?.channel_id || null,
          channelName: (result as any).incoming_webhook?.channel || 'general',
        },
        create: {
          userId: sessionUserId,
          accessToken: result.access_token,
          botUserId: result.bot_user_id || null,
          teamId: result.team?.id || 'unknown',
          teamName: result.team?.name || 'Slack Workspace',
          channelId: (result as any).incoming_webhook?.channel_id || null,
          channelName: (result as any).incoming_webhook?.channel || 'general',
        },
      });

      return res.redirect(`${config.clientUrl}/dashboard?slack_success=true`);
    }

    res.redirect(`${config.clientUrl}/dashboard?slack_error=oauth_failed`);
  } catch (err) {
    console.error('[Slack Callback Error]', err);
    res.redirect(`${config.clientUrl}/dashboard?slack_error=server_error`);
  }
});

// 5. Connect Mock Slack Workspace (For Seamless Demo Verification)
router.post('/slack/connect-mock', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { channelName } = req.body;

  const slackAccount = await prisma.slackAccount.upsert({
    where: { userId },
    update: {
      accessToken: 'xoxb-mock-slack-access-token',
      teamId: 'T01234567',
      teamName: 'ReachInbox Demo Workspace',
      channelId: 'C09876543',
      channelName: channelName || '#email-notifications',
    },
    create: {
      userId,
      accessToken: 'xoxb-mock-slack-access-token',
      teamId: 'T01234567',
      teamName: 'ReachInbox Demo Workspace',
      channelId: 'C09876543',
      channelName: channelName || '#email-notifications',
    },
  });

  res.json({
    message: 'Mock Slack connected successfully for demo mode',
    slackAccount,
  });
});

// 6. Disconnect Slack
router.post('/slack/disconnect', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  await prisma.slackAccount.deleteMany({
    where: { userId },
  });

  res.json({ message: 'Slack account disconnected successfully.' });
});

// 7. Logout
router.post('/logout', (req: Request, res: Response) => {
  const isProduction = config.nodeEnv === 'production';
  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout Error] Failed to destroy session:', err);
    }
    res.clearCookie('connect.sid', {
      path: '/',
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      httpOnly: true,
      domain: process.env.SESSION_DOMAIN || undefined,
    });
    res.json({ message: 'Logged out successfully.' });
  });
});

export default router;
