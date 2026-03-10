/**
 * Database Migration - Add profile_picture and bio to users table
 */
import db from '../db';

export const migrateDatabase = () => {
  db.serialize(() => {
    // Add profile_picture column if it doesn't exist
    db.run(`
      ALTER TABLE users ADD COLUMN profile_picture TEXT
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding profile_picture column:', err);
      } else if (!err) {
        console.log('Added profile_picture column to users table');
      }
    });

    // Add bio column if it doesn't exist
    db.run(`
      ALTER TABLE users ADD COLUMN bio TEXT
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding bio column:', err);
      } else if (!err) {
        console.log('Added bio column to users table');
      }
    });
  });
};
