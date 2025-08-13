/**
 * ADMIN CONFIGURATION
 * 
 * This is the single source of truth for admin users.
 * Add admin emails here to grant admin access.
 * 
 * IMPORTANT: After adding emails here, run:
 * npm run setup:admins
 * 
 * This will sync these emails to the Supabase admins table.
 */

export const ADMIN_EMAILS = [
  // Add your admin emails here, one per line
  // Example:
  // "admin@example.com",
  // "bezal@example.com",
  
  "bezalel3250@gmail.com", // Default admin
] as const;

// Type-safe admin emails
export type AdminEmail = typeof ADMIN_EMAILS[number];

// Helper to check if an email is admin
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email as AdminEmail);
}