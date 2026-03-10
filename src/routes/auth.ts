import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?.userId || 'unknown';
    const uniqueName = `profile_${userId}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures'));
    }
  }
});

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

// Register endpoint
router.post('/register', (req: Request<{}, {}, RegisterRequest>, res: Response): void => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email, and password are required' });
    return;
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, hashedPassword],
    function(err) {
      if (err) {
        if ((err as any).message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Username or email already exists' });
          return;
        }
        res.status(500).json({ error: (err as any).message });
        return;
      }

      const token = jwt.sign(
        { userId: this.lastID, username, email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        userId: this.lastID,
        username: username,
        email: email,
        profile_picture: null,
        bio: null,
        token
      });
    }
  );
});

// Login endpoint
router.post('/login', (req: Request<{}, {}, LoginRequest>, res: Response): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user: any) => {
    if (err) {
      res.status(500).json({ error: (err as any).message });
      return;
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      userId: user.id,
      username: user.username,
      email: user.email,
      profile_picture: user.profile_picture || null,
      bio: user.bio || null,
      token
    });
  });
});

// Get user profile
router.get('/profile/:userId', (req: Request, res: Response): void => {
  const { userId } = req.params;

  db.get(
    'SELECT id, username, email, profile_picture, bio, created_at FROM users WHERE id = ?',
    [userId],
    (err, user: any) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        message: 'User profile retrieved',
        user
      });
    }
  );
});

// Update user profile (text fields)
router.put('/profile', verifyToken, (req: Request, res: Response): void => {
  const userId = (req as any).user.userId;
  const { username, bio } = req.body;

  const updates: string[] = [];
  const values: any[] = [];

  if (username !== undefined) {
    updates.push('username = ?');
    values.push(username);
  }

  if (bio !== undefined) {
    updates.push('bio = ?');
    values.push(bio);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(userId);

  db.run(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        if ((err as any).message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Username already exists' });
          return;
        }
        res.status(500).json({ error: err.message });
        return;
      }

      // Fetch updated user data
      db.get(
        'SELECT id, username, email, profile_picture, bio FROM users WHERE id = ?',
        [userId],
        (err, user: any) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          res.json({
            message: 'Profile updated successfully',
            user
          });
        }
      );
    }
  );
});

// Update profile picture
router.post('/profile/picture', verifyToken, upload.single('profile_picture'), (req: Request, res: Response): void => {
  const userId = (req as any).user.userId;

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const profilePictureUrl = `/uploads/${req.file.filename}`;

  db.run(
    'UPDATE users SET profile_picture = ? WHERE id = ?',
    [profilePictureUrl, userId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({
        message: 'Profile picture updated successfully',
        profile_picture: profilePictureUrl
      });
    }
  );
});

export default router;
