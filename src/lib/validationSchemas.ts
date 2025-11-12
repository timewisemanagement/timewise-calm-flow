import { z } from 'zod';

// Authentication validation schemas
export const authSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
  displayName: z.string()
    .trim()
    .min(1, { message: "Display name is required" })
    .max(100, { message: "Display name must be less than 100 characters" })
    .optional(),
});

// Task validation schemas
export const taskSchema = z.object({
  title: z.string()
    .trim()
    .min(1, { message: "Title is required" })
    .max(200, { message: "Title must be less than 200 characters" }),
  description: z.string()
    .max(2000, { message: "Description must be less than 2000 characters" })
    .optional(),
  duration_minutes: z.number()
    .int({ message: "Duration must be a whole number" })
    .positive({ message: "Duration must be positive" })
    .max(1440, { message: "Duration cannot exceed 24 hours" }),
  priority: z.enum(['low', 'medium', 'high']),
  tags: z.string()
    .max(500, { message: "Tags must be less than 500 characters" })
    .optional(),
  scheduled_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format" })
    .optional(),
  scheduled_time: z.string()
    .regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" })
    .optional(),
  commute_minutes: z.number()
    .int()
    .min(0)
    .max(240, { message: "Commute cannot exceed 4 hours" })
    .optional(),
});

// Profile validation schemas
export const profileSchema = z.object({
  first_name: z.string()
    .trim()
    .max(100, { message: "First name must be less than 100 characters" })
    .optional(),
  last_name: z.string()
    .trim()
    .max(100, { message: "Last name must be less than 100 characters" })
    .optional(),
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  sleep_time: z.string()
    .regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" })
    .optional()
    .nullable(),
  wake_time: z.string()
    .regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" })
    .optional()
    .nullable(),
  downtime_start: z.string()
    .regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" })
    .optional()
    .nullable(),
  downtime_end: z.string()
    .regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" })
    .optional()
    .nullable(),
  focus_session_duration: z.number()
    .int()
    .min(5)
    .max(240, { message: "Focus session must be between 5 and 240 minutes" })
    .optional()
    .nullable(),
});
