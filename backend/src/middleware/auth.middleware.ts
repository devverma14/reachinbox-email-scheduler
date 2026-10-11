import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const userId = (req.session as any)?.userId || (isTestEnv ? (req.headers['x-user-id'] as string) : undefined);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId as string },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User session invalid.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]', error);
    res.status(500).json({ error: 'Authentication check failed.' });
  }
}
