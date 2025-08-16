/// <reference lib="deno.ns" />

import { Filter } from "npm:bad-words@4.0.0";
import { validate } from "npm:the-big-username-blacklist@1.5.2";

/**
 * Username filtering utility for Supabase Edge Functions
 * Validates usernames against inappropriate content and reserved terms
 */

export interface UsernameValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Comprehensive username filter for blocking inappropriate usernames
 */
class UsernameFilter {
  private profanityFilter: Filter;
  private reservedUsernames: Set<string>;

  constructor() {
    // Initialize profanity filter
    this.profanityFilter = new Filter();
    
    // Add additional reserved words to the profanity filter
    const additionalBadWords = [
      // System/admin reserved usernames
      'admin', 'administrator', 'root', 'system', 'mod', 'moderator',
      'support', 'help', 'staff', 'employee', 'official', 'bot',
      'api', 'www', 'mail', 'email', 'ftp', 'http', 'https',
      'null', 'undefined', 'test', 'guest', 'user', 'player',
      'chess', 'game', 'server', 'database', 'config',
      // Common variations
      'admins', 'mods', 'bots', 'guests', 'users', 'players',
    ];
    
    this.profanityFilter.addWords(...additionalBadWords);
    
    // System/admin reserved usernames for exact matching
    this.reservedUsernames = new Set([
      // Core system usernames
      'admin', 'administrator', 'root', 'system', 'sys', 'sysadmin',
      'mod', 'moderator', 'staff', 'support', 'help', 'helpdesk',
      'service', 'services', 'bot', 'bots', 'api', 'app',
      
      // Technical terms
      'www', 'ftp', 'mail', 'email', 'smtp', 'pop', 'imap',
      'http', 'https', 'ssl', 'tls', 'dns', 'dhcp',
      'localhost', 'server', 'host', 'domain', 'subdomain',
      'database', 'db', 'sql', 'nosql', 'redis', 'cache',
      
      // Application specific
      'chess', 'game', 'games', 'player', 'players', 'user', 'users',
      'guest', 'guests', 'anonymous', 'anon', 'temp', 'temporary',
      'test', 'testing', 'demo', 'example', 'sample',
      
      // Common programming terms
      'null', 'undefined', 'void', 'return', 'function', 'class',
      'object', 'array', 'string', 'number', 'boolean', 'true', 'false',
      
      // Social media reserved terms
      'about', 'contact', 'privacy', 'terms', 'legal', 'policy',
      'settings', 'config', 'configuration', 'profile', 'account',
      'login', 'logout', 'register', 'signup', 'signin',
      
      // Variations with common patterns
      'admin1', 'admin123', 'administrator1', 'root123',
      'test123', 'guest123', 'user123', 'player1',
    ]);
  }

  /**
   * Validates a username against multiple criteria
   */
  validateUsername(username: string): UsernameValidationResult {
    const normalizedUsername = username.toLowerCase().trim();
    
    // Check basic format requirements
    if (normalizedUsername.length < 3) {
      return {
        isValid: false,
        reason: 'Username must be at least 3 characters long'
      };
    }
    
    if (normalizedUsername.length > 20) {
      return {
        isValid: false,
        reason: 'Username must be no more than 20 characters long'
      };
    }
    
    // Check allowed characters (letters, numbers, underscore, hyphen)
    const allowedPattern = /^[a-z0-9_-]+$/;
    if (!allowedPattern.test(normalizedUsername)) {
      return {
        isValid: false,
        reason: 'Username can only contain letters, numbers, underscore (_), and hyphen (-)'
      };
    }
    
    // Check against reserved usernames
    if (this.reservedUsernames.has(normalizedUsername)) {
      return {
        isValid: false,
        reason: 'Username is not allowed'
      };
    }
    
    // Check for usernames that start with reserved patterns
    // Note: 'guest_' is explicitly blocked to prevent impersonation of guest users
    const reservedPrefixes = ['admin', 'mod', 'staff', 'support', 'bot', 'sys', 'guest', 'guest_', 'test', 'api'];
    for (const prefix of reservedPrefixes) {
      if (normalizedUsername.startsWith(prefix)) {
        return {
          isValid: false,
          reason: 'Username is not allowed'
        };
      }
    }
    
    // Check against profanity filter (includes racial slurs and hate speech)
    if (this.profanityFilter.isProfane(normalizedUsername)) {
      return {
        isValid: false,
        reason: 'Username is not allowed'
      };
    }
    
    // Use the-big-username-blacklist for additional validation
    if (!validate(normalizedUsername)) {
      return {
        isValid: false,
        reason: 'Username is not allowed'
      };
    }
    
    // Check for common inappropriate patterns
    const inappropriatePatterns = [
      /(.)\1{3,}/, // Too many repeated characters (aaaa)
      /^[0-9]+$/, // All numbers
      /^[_-]+$/, // Only special characters
      /[_-]{2,}/, // Multiple consecutive special characters
      /^[_-]/, // Starting with special character
      /[_-]$/, // Ending with special character
    ];
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(normalizedUsername)) {
        return {
          isValid: false,
          reason: 'Username format is not allowed'
        };
      }
    }
    
    return {
      isValid: true
    };
  }
}

// Export singleton instance
export const usernameFilter = new UsernameFilter();

// Export validation function for easy use
export function validateUsername(username: string): UsernameValidationResult {
  return usernameFilter.validateUsername(username);
}