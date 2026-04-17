// Email Configuration
// Priority: 1) Environment variables (.env file), 2) Fallback hardcoded values
import dotenv from 'dotenv';
dotenv.config();

export const emailConfig = {
  EMAIL_USER: process.env.EMAIL_HOST_USER || process.env.EMAIL_USER || 'rahulkirad.byline@gmail.com',
  EMAIL_PASS: process.env.EMAIL_HOST_PASSWORD || process.env.EMAIL_PASS || 'hzrekxezlhdiyyuh',
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: process.env.EMAIL_PORT || 587,
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'rahulkirad.byline@gmail.com',
};
