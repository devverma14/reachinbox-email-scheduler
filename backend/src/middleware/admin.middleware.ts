import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import prisma from '../lib/prisma';

/**
 * Server-side authorization middleware for administrative routes (e.g. Bull Board)
 * Protects raw queue job data & payload inspection from unauthenticated users.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const isTestEnv = config.nodeEnv === 'test';
  
  // Allow test header in test environment
  if (isTestEnv && req.headers['x-test-admin'] === 'true') {
    return next();
  }

  // 1. Check Admin Key header or query parameter
  const adminKeyHeader = (req.headers['x-admin-key'] as string) || (req.query.admin_key as string);
  if (adminKeyHeader && adminKeyHeader === config.admin.key) {
    return next();
  }

  // 2. Check HTTP Basic Auth header (admin:<config.admin.key>)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [user, pass] = credentials.split(':');
    if (user === 'admin' && pass === config.admin.key) {
      return next();
    }
  }

  // 3. Check if verified session user matches configured admin email
  let userEmail = (req as any).user?.email;

  if (!userEmail && (req.session as any)?.userId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: (req.session as any).userId },
        select: { email: true },
      });
      userEmail = dbUser?.email;
    } catch (_) {}
  }

  if (userEmail && userEmail === config.admin.email) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized. Admin access required.',
    message: 'Provide x-admin-key header, HTTP Basic Auth, or sign in with admin credentials to access queue management.',
  });
}
