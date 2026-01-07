/**
 * Phone number normalization and hashing utility for mobile app
 * Matches the backend implementation for consistent hashing
 */

/**
 * Normalizes a phone number to E.164 format (e.g., +12345678900)
 * Removes all non-digit characters and adds a +1 prefix if missing for 10-digit numbers.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, ''); // Remove all non-digit characters

  // If it already starts with '+' or has a country code, assume it's mostly correct
  if (phone.startsWith('+')) {
    return `+${digits}`;
  }

  // For 10-digit US numbers, prepend +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // For 11-digit numbers starting with 1, prepend +
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }

  // Default: add +1 prefix
  return `+1${digits}`;
}

/**
 * Hashes phone numbers using the backend endpoint
 * 
 * Note: For MVP, we hash on the backend to ensure consistency.
 * TODO: Move to client-side hashing using a crypto library for better privacy.
 * 
 * @param phones - Array of raw phone numbers (will be normalized first)
 * @param hashEndpoint - Function that calls the backend hash endpoint
 * @returns Array of hashed phone numbers
 */
export async function hashPhones(
  phones: string[], 
  hashEndpoint: (phones: string[]) => Promise<string[]>
): Promise<string[]> {
  // Normalize all phone numbers first
  const normalized = phones.map(normalizePhone);
  
  // Hash via backend endpoint
  return hashEndpoint(normalized);
}

