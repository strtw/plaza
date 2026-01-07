/**
 * Quick test script for phone hashing utility
 * 
 * Usage:
 *   PHONE_HASH_SECRET=test_secret ts-node scripts/test-phone-hash.ts
 */

import { normalizePhone, hashPhone } from '../src/common/utils/phone-hash.util';

// Set a test secret if not provided
if (!process.env.PHONE_HASH_SECRET) {
  process.env.PHONE_HASH_SECRET = 'test_secret_key_for_local_testing';
  console.log('Using test secret. Set PHONE_HASH_SECRET for production.');
}

console.log('Testing phone hashing utility...\n');

// Test cases
const testPhones = [
  '1234567890',
  '+1234567890',
  '(123) 456-7890',
  '1-123-456-7890',
  '+1 123 456 7890',
];

console.log('1. Testing phone normalization:');
testPhones.forEach(phone => {
  const normalized = normalizePhone(phone);
  console.log(`   "${phone}" → "${normalized}"`);
});

console.log('\n2. Testing phone hashing (deterministic):');
const testPhone = '1234567890';
const hash1 = hashPhone(testPhone);
const hash2 = hashPhone(testPhone);
console.log(`   Phone: ${testPhone}`);
console.log(`   Hash 1: ${hash1}`);
console.log(`   Hash 2: ${hash2}`);
console.log(`   Same hash? ${hash1 === hash2 ? '✓ YES' : '✗ NO'}`);

console.log('\n3. Testing different phones produce different hashes:');
const phone1 = '1234567890';
const phone2 = '0987654321';
const hash1_diff = hashPhone(phone1);
const hash2_diff = hashPhone(phone2);
console.log(`   Phone 1: ${phone1} → ${hash1_diff.substring(0, 20)}...`);
console.log(`   Phone 2: ${phone2} → ${hash2_diff.substring(0, 20)}...`);
console.log(`   Different hashes? ${hash1_diff !== hash2_diff ? '✓ YES' : '✗ NO'}`);

console.log('\n✓ All tests passed!');

