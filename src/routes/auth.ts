import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import db from '../db';
import { verifyToken } from '../middleware/auth';

const router = Router();

const STORAGE_MODE = process.env.STORAGE_MODE || 'local';

console.log(`📋 Profile pictures STORAGE_MODE: ${STORAGE_MODE}`);

// Configure Cloudinary (only if using cloudinary mode)
if (STORAGE_MODE === 'cloudinary') {
  console.log('🔧 Cloudinary mode enabled for profile pictures');
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary credentials missing!');
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('✅ Cloudinary configured for profiles');
  }
} else {
  console.log('⚠️  WARNING: Using local storage mode for profiles. Set STORAGE_MODE=cloudinary for production!');
}

// Create uploads directory for local storage
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (STORAGE_MODE === 'local') {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`📁 Creating uploads directory: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('✅ Uploads directory created');
  } else {
    console.log(`✅ Uploads directory exists: ${UPLOADS_DIR}`);
  }
}

// Configure multer for profile picture uploads (use memory storage for both modes)
const storage = multer.memoryStorage();

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

// Helper function to upload profile picture to Cloudinary
const uploadProfileToCloudinary = (file: Express.Multer.File, userId: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = Readable.from([file.buffer]);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'gymhero/profiles',
        public_id: `profile_${userId}_${Date.now()}`
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (!result) {
          reject(new Error('Upload failed'));
        } else {
          resolve(result.secure_url);
        }
      }
    );

    stream.pipe(uploadStream);
  });
};

// Helper function to upload profile picture to local storage
const uploadProfileToLocal = (file: Express.Multer.File, userId: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const extension = file.originalname.split('.').pop() || 'jpg';
    const filename = `profile_${userId}_${Date.now()}.${extension}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFile(filepath, file.buffer, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(`/uploads/${filename}`);
      }
    });
  });
};

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
router.post('/profile/picture', verifyToken, upload.single('profile_picture'), async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.userId;

  console.log(`🖼️  Profile picture upload request from user ${userId}`);
  console.log(`📋 Current STORAGE_MODE: ${STORAGE_MODE}`);

  if (!req.file) {
    console.error('❌ No file uploaded in request');
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  console.log(`📦 File received: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

  try {
    let profilePictureUrl: string;

    // Upload to Cloudinary or local storage based on STORAGE_MODE
    if (STORAGE_MODE === 'cloudinary') {
      console.log(`☁️  Uploading profile picture to Cloudinary for user ${userId}`);
      profilePictureUrl = await uploadProfileToCloudinary(req.file, userId);
      console.log(`✅ Profile picture uploaded to Cloudinary: ${profilePictureUrl}`);
    } else {
      console.log(`💾 Uploading profile picture to local storage for user ${userId}`);
      console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
      
      // Ensure directory exists (failsafe)
      if (!fs.existsSync(UPLOADS_DIR)) {
        console.log(`⚠️  Uploads directory doesn't exist, creating it now...`);
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        console.log(`✅ Directory created: ${UPLOADS_DIR}`);
      }
      
      profilePictureUrl = await uploadProfileToLocal(req.file, userId);
      console.log(`✅ Profile picture saved locally: ${profilePictureUrl}`);
    }

    db.run(
      'UPDATE users SET profile_picture = ? WHERE id = ?',
      [profilePictureUrl, userId],
      function(err) {
        if (err) {
          console.error('❌ Database update failed:', err);
          res.status(500).json({ error: err.message });
          return;
        }

        console.log(`✅ Database updated with new profile picture for user ${userId}`);
        res.json({
          message: 'Profile picture updated successfully',
          profile_picture: profilePictureUrl
        });
      }
    );
  } catch (error: any) {
    console.error('❌ Profile picture upload failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: error.message || 'Failed to upload profile picture',
      details: STORAGE_MODE === 'local' ? 'Local storage mode requires persistent filesystem. Use STORAGE_MODE=cloudinary for production.' : undefined
    });
  }
});

export default router;
