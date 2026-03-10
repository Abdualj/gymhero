require('dotenv').config();
const express = require('express');
const db = require('./db');
const authRoutes = require('./routes/auth');
const workoutRoutes = require('./routes/workouts');
const statsRoutes = require('./routes/stats');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/users', statsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GymHero API server running on port ${PORT}`);
});

module.exports = app;
