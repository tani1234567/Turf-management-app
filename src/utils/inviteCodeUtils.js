/**
 * Invite Code Utilities for the Turf Management System
 *
 * Invite codes are 8-character alphanumeric codes used by managers
 * and caretakers to join a company. Codes have no expiry and unlimited uses.
 */

/**
 * Generate a random 8-character alphanumeric invite code
 * @returns {string} 8-character uppercase alphanumeric code
 */
export function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate invite code format
 * @param {string} code - The invite code to validate
 * @returns {boolean} True if format is valid (8 alphanumeric characters)
 */
export function validateInviteCodeFormat(code) {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9]{8}$/i.test(code.trim());
}

/**
 * Format invite code to uppercase and trim whitespace
 * @param {string} code - The invite code to format
 * @returns {string} Formatted invite code
 */
export function formatInviteCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

/**
 * Generate shareable invite link from code
 * @param {string} code - The invite code
 * @returns {string} Full shareable URL
 */
export function generateInviteLink(code) {
  const formattedCode = formatInviteCode(code);
  // In production, this should be your actual domain
  return `https://turfbooking.app/join/${formattedCode}`;
}

/**
 * Extract invite code from a shareable link
 * @param {string} link - The invite link
 * @returns {string|null} Extracted code or null if invalid
 */
export function extractCodeFromLink(link) {
  if (!link || typeof link !== 'string') return null;

  // Match pattern: /join/CODE at the end of the URL
  const match = link.match(/\/join\/([A-Z0-9]{8})$/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Also try to match just the code if pasted directly
  if (validateInviteCodeFormat(link)) {
    return formatInviteCode(link);
  }

  return null;
}

/**
 * Create invite code object for Firestore
 * @param {string} ownerId - The owner who created/changed the code
 * @returns {object} Invite code object for Firestore
 */
export function createInviteCodeObject(ownerId) {
  const code = generateInviteCode();
  const now = new Date();

  return {
    code: code,
    link: generateInviteLink(code),
    createdAt: now,
    lastChangedAt: now,
    lastChangedBy: ownerId,
  };
}

/**
 * Update invite code object (regenerate code)
 * @param {string} ownerId - The owner who is changing the code
 * @returns {object} Updated invite code object
 */
export function regenerateInviteCodeObject(ownerId) {
  const code = generateInviteCode();
  const now = new Date();

  return {
    code: code,
    link: generateInviteLink(code),
    lastChangedAt: now,
    lastChangedBy: ownerId,
  };
}

/**
 * Format invite code for display (with spaces for readability)
 * @param {string} code - The 8-character code
 * @returns {string} Formatted code (e.g., "ABCD 1234")
 */
export function formatCodeForDisplay(code) {
  if (!code || code.length !== 8) return code || '';
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/**
 * Remove formatting from displayed code
 * @param {string} displayCode - The formatted code with spaces
 * @returns {string} Clean 8-character code
 */
export function cleanDisplayCode(displayCode) {
  if (!displayCode) return '';
  return displayCode.replace(/\s/g, '').toUpperCase();
}

export default {
  generateInviteCode,
  validateInviteCodeFormat,
  formatInviteCode,
  generateInviteLink,
  extractCodeFromLink,
  createInviteCodeObject,
  regenerateInviteCodeObject,
  formatCodeForDisplay,
  cleanDisplayCode,
};
