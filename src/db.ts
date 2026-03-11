import sqlite3 from 'sqlite3';
import path from 'path';

// Simple database path - works for both development and production
const dbPath = path.join(__dirname, '..', 'gymhero.db');

console.log(`📁 Database location: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Initialize database tables
db.serialize(() => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      profile_picture TEXT,
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('Users table initialized');
      
      // Add profile_picture and bio columns if they don't exist (migration)
      db.run('ALTER TABLE users ADD COLUMN profile_picture TEXT', (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error adding profile_picture column:', err);
        }
      });
      
      db.run('ALTER TABLE users ADD COLUMN bio TEXT', (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error adding bio column:', err);
        }
      });
    }
  });

  // Create workouts table
  db.run(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      media_url TEXT NOT NULL,
      media_type TEXT NOT NULL,
      caption TEXT,
      workout_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating workouts table:', err);
    } else {
      console.log('Workouts table initialized');
    }
  });

  // Create likes table
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      workout_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
      UNIQUE(user_id, workout_id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating likes table:', err);
    } else {
      console.log('Likes table initialized');
    }
  });

  // Create comments table
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      workout_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating comments table:', err);
    } else {
      console.log('Comments table initialized');
      
      // Log database statistics on startup
      db.get('SELECT COUNT(*) as count FROM users', [], (err, row: any) => {
        if (!err) console.log(`📊 Users in database: ${row.count}`);
      });
      
      db.get('SELECT COUNT(*) as count FROM workouts', [], (err, row: any) => {
        if (!err) console.log(`📊 Workouts in database: ${row.count}`);
      });
      
      db.get('SELECT COUNT(*) as count FROM likes', [], (err, row: any) => {
        if (!err) console.log(`📊 Likes in database: ${row.count}`);
      });
      
      db.get('SELECT COUNT(*) as count FROM comments', [], (err, row: any) => {
        if (!err) console.log(`📊 Comments in database: ${row.count}`);
      });
    }
  });
});

export default db;
