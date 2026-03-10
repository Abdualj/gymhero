import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import db from './db';
import authRoutes from './routes/auth';
import workoutRoutes from './routes/workouts';
import statsRoutes from './routes/stats';
import { globalErrorHandler } from './utils/errors';
import { migrateDatabase } from './utils/migrate';

const app = express();

// Run database migrations
migrateDatabase();

// CORS Configuration - Allow Netlify frontend and localhost
const allowedOrigins = [
  'http://localhost:3001', 
  'http://localhost:3002', 
  'http://localhost:3000',
  'https://gymhero-frontend.netlify.app', // Add your actual Netlify URL here
  /\.netlify\.app$/ // Allow all Netlify subdomains
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory (for local storage mode)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/users', statsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handling middleware
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GymHero API server running on port ${PORT}`);
});

export default app;
