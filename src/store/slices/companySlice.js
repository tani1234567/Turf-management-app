import { createSlice } from '@reduxjs/toolkit';

/**
 * Company Slice - Manages company state for the Turf Management System
 *
 * Company is the central entity that owns turfs and employs managers/caretakers.
 * Owners create companies, and managers/caretakers join via invite codes.
 */

const initialState = {
  // Current company data
  currentCompany: null,

  // Invite code info
  inviteCode: null,

  // Company statistics
  stats: {
    totalTurfs: 0,
    totalGrounds: 0,
    totalBookings: 0,
    totalRevenue: 0,
    activeUsers: 0,
  },

  // Team members
  managers: [],
  caretakers: [],
  unassignedCaretakers: [],

  // Subscription info
  subscription: {
    status: 'trial', // trial | active | expired | grace_period
    trialStartDate: null,
    trialEndDate: null,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    gracePeriodEndDate: null,
    totalGrounds: 0,
    pricePerGroundMonthly: 299,
    totalMonthlyFee: 0,
    discount: 0,
  },

  // Loading and error states
  isLoading: false,
  error: null,
};

const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    // Set the entire company object
    setCompany: (state, action) => {
      state.currentCompany = action.payload;
      if (action.payload) {
        // Extract nested data if present
        if (action.payload.inviteCode) {
          state.inviteCode = action.payload.inviteCode;
        }
        if (action.payload.stats) {
          state.stats = action.payload.stats;
        }
        if (action.payload.subscription) {
          state.subscription = action.payload.subscription;
        }
        if (action.payload.managers) {
          state.managers = action.payload.managers;
        }
        if (action.payload.caretakers) {
          state.caretakers = action.payload.caretakers;
        }
        if (action.payload.unassignedCaretakers) {
          state.unassignedCaretakers = action.payload.unassignedCaretakers;
        }
      }
      state.error = null;
    },

    // Update invite code
    setInviteCode: (state, action) => {
      state.inviteCode = action.payload;
      if (state.currentCompany) {
        state.currentCompany.inviteCode = action.payload;
      }
    },

    // Update company stats
    updateStats: (state, action) => {
      state.stats = { ...state.stats, ...action.payload };
      if (state.currentCompany) {
        state.currentCompany.stats = state.stats;
      }
    },

    // Set managers list
    setManagers: (state, action) => {
      state.managers = action.payload;
    },

    // Add a manager
    addManager: (state, action) => {
      if (!state.managers.includes(action.payload)) {
        state.managers.push(action.payload);
      }
    },

    // Remove a manager
    removeManager: (state, action) => {
      state.managers = state.managers.filter(id => id !== action.payload);
    },

    // Set caretakers list
    setCaretakers: (state, action) => {
      state.caretakers = action.payload;
    },

    // Add a caretaker
    addCaretaker: (state, action) => {
      if (!state.caretakers.includes(action.payload)) {
        state.caretakers.push(action.payload);
      }
    },

    // Remove a caretaker
    removeCaretaker: (state, action) => {
      state.caretakers = state.caretakers.filter(id => id !== action.payload);
    },

    // Set unassigned caretakers list
    setUnassignedCaretakers: (state, action) => {
      state.unassignedCaretakers = action.payload;
    },

    // Add to unassigned caretakers
    addUnassignedCaretaker: (state, action) => {
      if (!state.unassignedCaretakers.includes(action.payload)) {
        state.unassignedCaretakers.push(action.payload);
      }
    },

    // Remove from unassigned (when assigned to turf)
    removeUnassignedCaretaker: (state, action) => {
      state.unassignedCaretakers = state.unassignedCaretakers.filter(
        id => id !== action.payload
      );
    },

    // Update subscription
    setSubscription: (state, action) => {
      state.subscription = { ...state.subscription, ...action.payload };
      if (state.currentCompany) {
        state.currentCompany.subscription = state.subscription;
      }
    },

    // Set loading state
    setCompanyLoading: (state, action) => {
      state.isLoading = action.payload;
    },

    // Set error state
    setCompanyError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Clear company state (on logout or switch)
    clearCompany: (state) => {
      return initialState;
    },
  },
});

// Export actions
export const {
  setCompany,
  setInviteCode,
  updateStats,
  setManagers,
  addManager,
  removeManager,
  setCaretakers,
  addCaretaker,
  removeCaretaker,
  setUnassignedCaretakers,
  addUnassignedCaretaker,
  removeUnassignedCaretaker,
  setSubscription,
  setCompanyLoading,
  setCompanyError,
  clearCompany,
} = companySlice.actions;

// Selectors
export const selectCompany = (state) => state.company.currentCompany;
export const selectCompanyId = (state) => state.company.currentCompany?.companyId;
export const selectCompanyName = (state) => state.company.currentCompany?.name;
export const selectInviteCode = (state) => state.company.inviteCode;
export const selectCompanyStats = (state) => state.company.stats;
export const selectManagers = (state) => state.company.managers;
export const selectCaretakers = (state) => state.company.caretakers;
export const selectUnassignedCaretakers = (state) => state.company.unassignedCaretakers;
export const selectSubscription = (state) => state.company.subscription;
export const selectSubscriptionStatus = (state) => state.company.subscription?.status;
export const selectCompanyLoading = (state) => state.company.isLoading;
export const selectCompanyError = (state) => state.company.error;

// Derived selectors
export const selectIsTrialActive = (state) => {
  const subscription = state.company.subscription;
  if (subscription?.status !== 'trial') return false;
  if (!subscription.trialEndDate) return true;
  return new Date(subscription.trialEndDate) > new Date();
};

export const selectIsSubscriptionActive = (state) => {
  const status = state.company.subscription?.status;
  return status === 'active' || status === 'trial';
};

export const selectTotalTeamMembers = (state) => {
  return state.company.managers.length + state.company.caretakers.length;
};

export default companySlice.reducer;
