const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// POST /api/workouts - Upload media and save workout
// Middleware must be applied before this route handler
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, MP4, MOV'));
    }
  }
});

router.post('/', verifyToken, upload.single('media'), (req, res) => {
  const { caption, workout_type } = req.body;
  const userId = req.userId;

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ error: 'Media file is required' });
  }

  const file = req.file;
  const isVideo = file.mimetype.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';

  // Create a readable stream from the buffer
  const stream = Readable.from([file.buffer]);

  // Upload to Cloudinary
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      resource_type: resourceType,
      folder: 'gymhero/workouts',
      public_id: `${userId}_${Date.now()}`
    },
    (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({ error: 'Failed to upload media to Cloudinary' });
      }

      const mediaUrl = result.secure_url;
      const mediaType = resourceType;

      // Save to database
      db.run(
        'INSERT INTO workouts (user_id, media_url, media_type, caption, workout_type) VALUES (?, ?, ?, ?, ?)',
        [userId, mediaUrl, mediaType, caption || null, workout_type || null],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to save workout to database' });
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
    }
  );

  stream.pipe(uploadStream);
});

// GET /api/workouts - Get all workouts for the authenticated user
router.get('/', verifyToken, (req, res) => {
  const userId = req.userId;

  db.all(
    'SELECT * FROM workouts WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: 'Workouts retrieved successfully',
        workouts: rows || []
      });
    }
  );
});

// GET /api/workouts/:id - Get a specific workout
router.get('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  db.get(
    'SELECT * FROM workouts WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Workout not found' });
      }

      res.json({
        message: 'Workout retrieved successfully',
        workout: row
      });
    }
  );
});

// DELETE /api/workouts/:id - Delete a workout
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  db.run(
    'DELETE FROM workouts WHERE id = ? AND user_id = ?',
    [id, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Workout not found' });
      }

      res.json({ message: 'Workout deleted successfully' });
    }
  );
});

// POST /api/workouts/:id/like - Like a workout
router.post('/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  // Check if workout exists
  db.get('SELECT id FROM workouts WHERE id = ?', [id], (err, workout) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    // Add like
    db.run(
      'INSERT INTO likes (user_id, workout_id) VALUES (?, ?)',
      [userId, id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Already liked this workout' });
          }
          return res.status(500).json({ error: err.message });
        }

        // Get updated like count
        db.get(
          'SELECT COUNT(*) as like_count FROM likes WHERE workout_id = ?',
          [id],
          (err, result) => {
            if (err) {
              return res.status(500).json({ error: err.message });
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
router.delete('/:id/like', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  db.run(
    'DELETE FROM likes WHERE user_id = ? AND workout_id = ?',
    [userId, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Like not found' });
      }

      // Get updated like count
      db.get(
        'SELECT COUNT(*) as like_count FROM likes WHERE workout_id = ?',
        [id],
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: err.message });
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
router.get('/:id/likes', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  // Get like count and whether current user liked it
  db.get(
    `SELECT 
      (SELECT COUNT(*) FROM likes WHERE workout_id = ?) as like_count,
      (SELECT COUNT(*) FROM likes WHERE workout_id = ? AND user_id = ?) as user_liked
    `,
    [id, id, userId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        like_count: result.like_count,
        liked: result.user_liked > 0
      });
    }
  );
});

// GET /api/workouts/:id/comments - Get comments for a workout
router.get('/:id/comments', verifyToken, (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT c.*, u.username 
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.workout_id = ?
     ORDER BY c.created_at ASC`,
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        comments: rows || []
      });
    }
  );
});

// POST /api/workouts/:id/comments - Add a comment to a workout
router.post('/:id/comments', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  // Check if workout exists
  db.get('SELECT id FROM workouts WHERE id = ?', [id], (err, workout) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    // Add comment
    db.run(
      'INSERT INTO comments (user_id, workout_id, text) VALUES (?, ?, ?)',
      [userId, id, text.trim()],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Get the created comment with username
        db.get(
          `SELECT c.*, u.username 
           FROM comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.id = ?`,
          [this.lastID],
          (err, comment) => {
            if (err) {
              return res.status(500).json({ error: err.message });
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

module.exports = router;
