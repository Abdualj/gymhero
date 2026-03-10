const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/:id/stats - Get workout statistics for a user
router.get('/:id/stats', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  // Only allow users to view their own stats or require admin role
  if (parseInt(id) !== userId) {
    return res.status(403).json({ error: 'You can only view your own stats' });
  }

  db.get(
    'SELECT COUNT(*) as total_workouts FROM workouts WHERE user_id = ?',
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const totalWorkouts = result?.total_workouts || 0;

      res.json({
        message: 'User stats retrieved successfully',
        stats: {
          userId: parseInt(id),
          total_workouts: totalWorkouts
        }
      });
    }
  );
});

// GET /api/users/:id/streaks - Get consecutive workout days streak
router.get('/:id/streaks', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  // Only allow users to view their own streaks
  if (parseInt(id) !== userId) {
    return res.status(403).json({ error: 'You can only view your own streaks' });
  }

  db.all(
    `SELECT DATE(created_at) as workout_date 
     FROM workouts 
     WHERE user_id = ? 
     GROUP BY DATE(created_at) 
     ORDER BY workout_date DESC`,
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Calculate current streak
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 1;

      if (rows && rows.length > 0) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const lastWorkoutDate = new Date(rows[0].workout_date);
        const lastWorkoutDateFormatted = lastWorkoutDate.toISOString().split('T')[0];
        const todayFormatted = today.toISOString().split('T')[0];
        const yesterdayFormatted = yesterday.toISOString().split('T')[0];

        // Check if the user worked out today or yesterday (for ongoing streak)
        if (lastWorkoutDateFormatted === todayFormatted || lastWorkoutDateFormatted === yesterdayFormatted) {
          currentStreak = 1;
        }

        // Calculate streaks
        for (let i = 1; i < rows.length; i++) {
          const currentDate = new Date(rows[i].workout_date);
          const prevDate = new Date(rows[i - 1].workout_date);

          const dayDiff = Math.floor((prevDate - currentDate) / (1000 * 60 * 60 * 24));

          if (dayDiff === 1) {
            tempStreak++;
            if (i === 1 && (lastWorkoutDateFormatted === todayFormatted || lastWorkoutDateFormatted === yesterdayFormatted)) {
              currentStreak = tempStreak;
            }
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }

        longestStreak = Math.max(longestStreak, tempStreak);
      }

      res.json({
        message: 'User streaks retrieved successfully',
        streaks: {
          userId: parseInt(id),
          current_streak: currentStreak,
          longest_streak: longestStreak,
          total_unique_workout_days: rows?.length || 0
        }
      });
    }
  );
});

module.exports = router;
