import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import db from '../db';
import { verifyToken } from '../middleware/auth';
import { isValidFileType } from '../utils/helpers';

const router = Router();

const STORAGE_MODE = process.env.STORAGE_MODE || 'local';

// Configure Cloudinary (only if using cloudinary mode)
if (STORAGE_MODE === 'cloudinary') {
  console.log('🔧 Cloudinary mode enabled');
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary credentials missing! Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('✅ Cloudinary configured successfully');
  }
} else {
  console.log('📁 Using local storage mode');
}

// Create uploads directory for local storage
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (STORAGE_MODE === 'local' && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (isValidFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

interface WorkoutRequest {
  caption?: string;
  workout_type?: string;
}

// Helper function to upload to local storage
const uploadToLocal = (file: Express.Multer.File, userId: number): Promise<{ url: string; type: string }> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.mimetype.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    const extension = file.originalname.split('.').pop() || 'jpg';
    const filename = `${userId}_${Date.now()}.${extension}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFile(filepath, file.buffer, (err) => {
      if (err) {
        reject(err);
      } else {
        // Return URL relative to server
        resolve({
          url: `/uploads/${filename}`,
          type: resourceType
        });
      }
    });
  });
};

// Helper function to upload to Cloudinary
const uploadToCloudinary = (file: Express.Multer.File, userId: number): Promise<{ url: string; type: string }> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.mimetype.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    const stream = Readable.from([file.buffer]);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType as 'image' | 'video' | 'raw',
        folder: 'gymhero/workouts',
        public_id: `${userId}_${Date.now()}`
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (!result) {
          reject(new Error('Upload failed'));
        } else {
          resolve({
            url: result.secure_url,
            type: resourceType
          });
        }
      }
    );

    stream.pipe(uploadStream);
  });
};

// POST /api/workouts - Upload media and save workout
router.post(
  '/',
  verifyToken,
  upload.single('media'),
  async (req: Request<{}, {}, WorkoutRequest>, res: Response): Promise<void> => {
    const { caption, workout_type } = req.body;
    const userId = req.userId;

    if (!req.file) {
      res.status(400).json({ error: 'Media file is required' });
      return;
    }

    try {
      let mediaUrl: string;
      let mediaType: string;

      console.log(`📤 Uploading file for user ${userId} using ${STORAGE_MODE} mode`);

      // Upload based on storage mode
      if (STORAGE_MODE === 'local') {
        const result = await uploadToLocal(req.file, userId!);
        mediaUrl = result.url;
        mediaType = result.type;
        console.log('✅ Local upload successful:', mediaUrl);
      } else if (STORAGE_MODE === 'cloudinary') {
        const result = await uploadToCloudinary(req.file, userId!);
        mediaUrl = result.url;
        mediaType = result.type;
        console.log('✅ Cloudinary upload successful:', mediaUrl);
      } else {
        throw new Error(`Invalid STORAGE_MODE: ${STORAGE_MODE}`);
      }

      // Save to database
      db.run(
        'INSERT INTO workouts (user_id, media_url, media_type, caption, workout_type) VALUES (?, ?, ?, ?, ?)',
        [userId, mediaUrl, mediaType, caption || null, workout_type || null],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Failed to save workout to database' });
            return;
          }

          res.status(201).json({
            message: 'Workout uploaded successfully',
            workoutId: this.lastID,
            mediaUrl,
            mediaType,
            caption: caption || null,
            workout_type: workout_type || null
          });
        }
      );
    } catch (error) {
      console.error('❌ Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        error: STORAGE_MODE === 'cloudinary' 
          ? `Failed to upload to Cloudinary: ${errorMessage}`
          : `Failed to save file locally: ${errorMessage}`,
        details: errorMessage
      });
    }
  }
);

// GET /api/workouts/feed - Get all workouts from all users (PUBLIC - no auth required)
router.get('/feed', (req: Request, res: Response): void => {
  db.all(
    `SELECT 
      workouts.*, 
      users.username, 
      users.email,
      (SELECT COUNT(*) FROM likes WHERE likes.workout_id = workouts.id) as like_count
     FROM workouts 
     JOIN users ON workouts.user_id = users.id 
     ORDER BY workouts.created_at DESC`,
    [],
    (err, rows: any[]) => {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }

      res.json({
        message: 'Feed retrieved successfully',
        workouts: rows || []
      });
    }
  );
});

// GET /api/workouts - Get all workouts for the authenticated user
router.get('/', verifyToken, (req: Request, res: Response): void => {
  const userId = req.userId;

  db.all(
    `SELECT 
      workouts.*,
      users.username,
      users.email,
      (SELECT COUNT(*) FROM likes WHERE likes.workout_id = workouts.id) as like_count
     FROM workouts 
     JOIN users ON workouts.user_id = users.id
     WHERE workouts.user_id = ? 
     ORDER BY workouts.created_at DESC`,
    [userId],
    (err, rows: any[]) => {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }

      res.json({
        message: 'Workouts retrieved successfully',
        workouts: rows || []
      });
    }
  );
});

// GET /api/workouts/:id - Get a specific workout
router.get('/:id', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId;

  db.get(
    'SELECT * FROM workouts WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, row: any) => {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }

      if (!row) {
        res.status(404).json({ error: 'Workout not found' });
        return;
      }

      res.json({
        message: 'Workout retrieved successfully',
        workout: row
      });
    }
  );
});

// DELETE /api/workouts/:id - Delete a workout
router.delete('/:id', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId;

  db.run(
    'DELETE FROM workouts WHERE id = ? AND user_id = ?',
    [id, userId],
    function(err) {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }

      if (this.changes === 0) {
        res.status(404).json({ error: 'Workout not found' });
        return;
      }

      res.json({ message: 'Workout deleted successfully' });
    }
  );
});

// POST /api/workouts/:id/like - Like a workout
router.post('/:id/like', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId;

  // Check if workout exists
  db.get('SELECT id FROM workouts WHERE id = ?', [id], (err, workout: any) => {
    if (err) {
      res.status(500).json({ error: (err as any).message });
      return;
    }
    if (!workout) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    // Add like
    db.run(
      'INSERT INTO likes (user_id, workout_id) VALUES (?, ?)',
      [userId, id],
      function(err) {
        if (err) {
          if ((err as any).message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Already liked this workout' });
            return;
          }
          res.status(500).json({ error: (err as any).message });
          return;
        }

        // Get updated like count
        db.get(
          'SELECT COUNT(*) as like_count FROM likes WHERE workout_id = ?',
          [id],
          (err, result: any) => {
            if (err) {
              res.status(500).json({ error: (err as any).message });
              return;
            }
            res.json({ 
              message: 'Workout liked successfully',
              like_count: result.like_count,
              liked: true
            });
          }
        );
      }
    );
  });
});

// DELETE /api/workouts/:id/like - Unlike a workout
router.delete('/:id/like', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId;

  db.run(
    'DELETE FROM likes WHERE user_id = ? AND workout_id = ?',
    [userId, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }

      if (this.changes === 0) {
        res.status(404).json({ error: 'Like not found' });
        return;
      }

      // Get updated like count
      db.get(
        'SELECT COUNT(*) as like_count FROM likes WHERE workout_id = ?',
        [id],
        (err, result: any) => {
          if (err) {
            res.status(500).json({ error: (err as any).message });
            return;
          }
          res.json({ 
            message: 'Workout unliked successfully',
            like_count: result.like_count,
            liked: false
          });
        }
      );
    }
  );
});

// GET /api/workouts/:id/likes - Get likes for a workout
router.get('/:id/likes', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId;

  // Get like count and whether current user liked it
  db.get(
    `SELECT 
      (SELECT COUNT(*) FROM likes WHERE workout_id = ?) as like_count,
      (SELECT COUNT(*) FROM likes WHERE workout_id = ? AND user_id = ?) as user_liked
    `,
    [id, id, userId],
    (err, result: any) => {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }
      res.json({ 
        like_count: result.like_count,
        liked: result.user_liked > 0
      });
    }
  );
});

// GET /api/workouts/:id/comments - Get comments for a workout
router.get('/:id/comments', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params;

  db.all(
    `SELECT c.*, u.username 
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.workout_id = ?
     ORDER BY c.created_at ASC`,
    [id],
    (err, rows: any[]) => {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }
      res.json({ 
        comments: rows || []
      });
    }
  );
});

// POST /api/workouts/:id/comments - Add a comment to a workout
router.post('/:id/comments', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const userId = req.userId;
  const { text } = req.body;

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Comment text is required' });
    return;
  }

  // Check if workout exists
  db.get('SELECT id FROM workouts WHERE id = ?', [id], (err, workout: any) => {
    if (err) {
      res.status(500).json({ error: (err as any).message });
      return;
    }
    if (!workout) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }

    // Add comment
    db.run(
      'INSERT INTO comments (user_id, workout_id, text) VALUES (?, ?, ?)',
      [userId, id, text.trim()],
      function(err) {
        if (err) {
          res.status(500).json({ error: (err as any).message });
          return;
        }

        // Get the created comment with username
        db.get(
          `SELECT c.*, u.username 
           FROM comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.id = ?`,
          [this.lastID],
          (err, comment: any) => {
            if (err) {
              res.status(500).json({ error: (err as any).message });
              return;
            }
            res.status(201).json({ 
              message: 'Comment added successfully',
              comment
            });
          }
        );
      }
    );
  });
});

export default router;
