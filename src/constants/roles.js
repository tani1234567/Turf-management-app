/**
 * Role constants for the Turf Management System
 * V2 4-Tier Hierarchy: Owner -> Manager -> Caretaker -> User
 */

export const ROLES = {
  USER: 'user',
  OWNER: 'owner',
  MANAGER: 'manager',
  CARETAKER: 'caretaker',
  ADMIN: 'admin',
};

// Role hierarchy for permission checking (higher index = more permissions)
export const ROLE_HIERARCHY = ['user', 'caretaker', 'manager', 'owner', 'admin'];

// Role display information for UI
export const ROLE_INFO = {
  [ROLES.USER]: {
    title: 'User',
    description: 'Book turfs for your games, view availability, and manage your bookings',
    icon: 'account',
    color: '#4CAF50',
    features: ['Browse & book turfs', 'View booking history', 'Chat with managers'],
  },
  [ROLES.OWNER]: {
    title: 'Turf Owner',
    description: 'Own and manage turf businesses, handle subscriptions, and oversee operations',
    icon: 'office-building',
    color: '#9C27B0',
    features: ['Create & manage company', 'Add turfs & grounds', 'View company analytics'],
  },
  [ROLES.MANAGER]: {
    title: 'Manager',
    description: 'Manage turf operations, handle bookings, and coordinate with caretakers',
    icon: 'briefcase',
    color: '#2196F3',
    features: ['Manage multiple turfs', 'Accept/reject bookings', 'View analytics'],
  },
  [ROLES.CARETAKER]: {
    title: 'Caretaker',
    description: 'Handle day-to-day operations, collect payments, and manage on-ground activities',
    icon: 'account-hard-hat',
    color: '#FF9800',
    features: ['View daily schedule', 'Collect payments', 'Mark attendance'],
  },
  [ROLES.ADMIN]: {
    title: 'Admin',
    description: 'System administrator with full access',
    icon: 'shield-account',
    color: '#F44336',
    features: ['Full system access', 'Manage all companies', 'System settings'],
  },
};

/**
 * Check if a role has permission based on hierarchy
 * @param {string} userRole - The user's current role
 * @param {string} requiredRole - The minimum role required
 * @returns {boolean}
 */
export function hasRolePermission(userRole, requiredRole) {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return userIndex >= requiredIndex;
}

/**
 * Check if role requires company association
 * @param {string} role
 * @returns {boolean}
 */
export function requiresCompany(role) {
  return [ROLES.OWNER, ROLES.MANAGER, ROLES.CARETAKER].includes(role);
}

/**
 * Check if role requires invite code to join
 * @param {string} role
 * @returns {boolean}
 */
export function requiresInviteCode(role) {
  return [ROLES.MANAGER, ROLES.CARETAKER].includes(role);
}

export default ROLES;
