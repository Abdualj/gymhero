import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: {
        userId: number;
        username?: string;
        email?: string;
      };
    }
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

  if (!token) {
    res.status(401).json({ error: 'Token is required' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    const decodedToken = decoded as { userId: number; username?: string; email?: string };
    req.userId = decodedToken.userId;
    req.user = {
      userId: decodedToken.userId,
      username: decodedToken.username,
      email: decodedToken.email
    };
    next();
  });
};
