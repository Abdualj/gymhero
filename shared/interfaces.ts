/**
 * Shared TypeScript Interfaces for GymHero
 * These interfaces are used across both frontend and backend
 */

// ============ User & Auth ============
export interface User {
  id: number;
  username: string;
  email: string;
  profile_picture?: string | null;
  bio?: string | null;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  userId: number;
  username: string;
  email: string;
  profile_picture?: string | null;
  bio?: string | null;
  token: string;
}

export interface UpdateProfileRequest {
  username?: string;
  bio?: string;
  profile_picture?: File;
}

// ============ Workout ============
export type WorkoutType = 'push' | 'pull' | 'legs' | 'cardio' | 'full-body' | 'other';
export type MediaType = 'image' | 'video';

export interface Workout {
  id: number;
  user_id: number;
  media_url: string;
  media_type: MediaType;
  caption: string | null;
  workout_type: WorkoutType | null;
  created_at: string;
}

export interface CreateWorkoutRequest {
  media: File;
  caption?: string;
  workout_type?: WorkoutType;
}

export interface WorkoutResponse {
  message: string;
  workout?: Workout;
  workouts?: Workout[];
  workoutId?: number;
  mediaUrl?: string;
  mediaType?: MediaType;
}

// ============ Statistics ============
export interface UserStats {
  userId: number;
  total_workouts: number;
}

export interface StatsResponse {
  message: string;
  stats: UserStats;
}

export interface UserStreaks {
  userId: number;
  current_streak: number;
  longest_streak: number;
  total_unique_workout_days: number;
}

export interface StreaksResponse {
  message: string;
  streaks: UserStreaks;
}

// ============ Error Handling ============
export interface ApiError {
  message: string;
  status: number;
  data?: {
    error: string;
  };
}

export interface ErrorResponse {
  error: string;
  [key: string]: any;
}

// ============ API Responses ============
export interface SuccessResponse<T> {
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  message: string;
  data: T[];
  total: number;
  page: number;
  limit: number;
}
