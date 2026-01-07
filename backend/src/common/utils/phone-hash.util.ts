import { createHmac } from 'crypto';

/**
 * Normalizes a phone number to a consistent format
 * - Removes all non-digit characters
 * - Ensures it starts with +1 (US format)
 * - Returns in format: +1XXXXXXXXXX
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, add +
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }
  
  // If it has 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it already starts with +, return as is (after normalizing digits)
  if (phone.startsWith('+')) {
    return `+${digits}`;
  }
  
  // Default: add +1 prefix
  return `+1${digits}`;
}

/**
 * Hashes a phone number using HMAC-SHA256
 * Uses PHONE_HASH_SECRET from environment variables
 * 
 * @param phone - Raw phone number (will be normalized first)
 * @returns Hashed phone number (hex string)
 */
export function hashPhone(phone: string): string {
  const secret = process.env.PHONE_HASH_SECRET;
  
  if (!secret) {
    throw new Error('PHONE_HASH_SECRET environment variable is not set');
  }
  
  // Normalize phone number first
  const normalized = normalizePhone(phone);
  
  // Create HMAC hash
  const hmac = createHmac('sha256', secret);
  hmac.update(normalized);
  
  return hmac.digest('hex');
}

