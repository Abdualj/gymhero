import { Router, Request, Response } from 'express';
import db from '../db';
import { verifyToken } from '../middleware/auth';
import { formatDate, calculateDayDifference } from '../utils/helpers';

const router = Router();

interface WorkoutDate {
  workout_date: string;
}

// GET /api/users/:id/stats - Get workout statistics for a user
router.get('/:id/stats', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params as { id: string };
  const userId = req.userId;

  // Only allow users to view their own stats
  if (parseInt(id) !== userId) {
    res.status(403).json({ error: 'You can only view your own stats' });
    return;
  }

  db.get(
    'SELECT COUNT(*) as total_workouts FROM workouts WHERE user_id = ?',
    [id],
    (err, result: any) => {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
      }

      const totalWorkouts = result?.total_workouts || 0;

      res.json({
        message: 'User stats retrieved successfully',
        stats: {
          userId: typeof id === 'string' ? parseInt(id) : id,
          total_workouts: totalWorkouts
        }
      });
    }
  );
});

// GET /api/users/:id/streaks - Get consecutive workout days streak
router.get('/:id/streaks', verifyToken, (req: Request, res: Response): void => {
  const { id } = req.params as { id: string };
  const userId = req.userId;

  // Only allow users to view their own streaks
  if (parseInt(id) !== userId) {
    res.status(403).json({ error: 'You can only view your own streaks' });
    return;
  }

  db.all(
    `SELECT DATE(created_at) as workout_date 
     FROM workouts 
     WHERE user_id = ? 
     GROUP BY DATE(created_at) 
     ORDER BY workout_date DESC`,
    [id],
    (err, rows: WorkoutDate[]) => {
      if (err) {
        res.status(500).json({ error: (err as any).message });
        return;
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
        const lastWorkoutDateFormatted = formatDate(lastWorkoutDate);
        const todayFormatted = formatDate(today);
        const yesterdayFormatted = formatDate(yesterday);

        // Check if the user worked out today or yesterday (for ongoing streak)
        if (lastWorkoutDateFormatted === todayFormatted || lastWorkoutDateFormatted === yesterdayFormatted) {
          currentStreak = 1;
        }

        // Calculate streaks
        for (let i = 1; i < rows.length; i++) {
          const currentDate = new Date(rows[i].workout_date);
          const prevDate = new Date(rows[i - 1].workout_date);

          const dayDiff = calculateDayDifference(prevDate, currentDate);

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
          userId: typeof id === 'string' ? parseInt(id) : id,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          total_unique_workout_days: rows?.length || 0
        }
      });
    }
  );
});

export default router;
