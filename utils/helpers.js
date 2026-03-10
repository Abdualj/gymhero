const fs = require('fs');
const path = require('path');

/**
 * Ensure a directory exists, create it if it doesn't
 * @param {string} dirPath - Path to the directory
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Get file extension from filename
 * @param {string} filename - The filename
 * @returns {string} - File extension
 */
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

/**
 * Check if file is an image
 * @param {string} mimetype - MIME type of the file
 * @returns {boolean}
 */
const isImageFile = (mimetype) => {
  return mimetype.startsWith('image/');
};

/**
 * Check if file is a video
 * @param {string} mimetype - MIME type of the file
 * @returns {boolean}
 */
const isVideoFile = (mimetype) => {
  return mimetype.startsWith('video/');
};

/**
 * Format date to readable string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

module.exports = {
  ensureDirectoryExists,
  getFileExtension,
  isImageFile,
  isVideoFile,
  formatDate
};
