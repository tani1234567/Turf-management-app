import { createSlice } from '@reduxjs/toolkit';

/**
 * Owner Slice - Manages owner-specific state for the Turf Management System
 *
 * Owners are business owners who create companies, manage turfs,
 * and can optionally have operational permissions to do manager tasks.
 */

const initialState = {
  // Turfs owned by the company
  turfs: [],

  // Currently selected turf for viewing/editing
  selectedTurf: null,

  // Analytics data
  analytics: {
    daily: null,
    weekly: null,
    monthly: null,
  },

  // Financial reports
  financialReports: {
    revenue: 0,
    expenses: 0,
    profit: 0,
    pendingPayments: 0,
  },

  // Manager performance data (for owner dashboard)
  managerPerformance: [],

  // Recent activities
  recentActivities: [],

  // Pending actions count
  pendingActions: {
    bookingRequests: 0,
    unassignedCaretakers: 0,
    maintenanceIssues: 0,
    expiringAcademies: 0,
  },

  // Loading and error states
  isLoading: false,
  error: null,
};

const ownerSlice = createSlice({
  name: 'owner',
  initialState,
  reducers: {
    // Set all turfs
    setTurfs: (state, action) => {
      state.turfs = action.payload;
      state.error = null;
    },

    // Add a new turf
    addTurf: (state, action) => {
      state.turfs.push(action.payload);
    },

    // Update an existing turf
    updateTurf: (state, action) => {
      const index = state.turfs.findIndex(
        turf => turf.turfId === action.payload.turfId
      );
      if (index !== -1) {
        state.turfs[index] = { ...state.turfs[index], ...action.payload };
      }
      // Also update selectedTurf if it's the same turf
      if (state.selectedTurf?.turfId === action.payload.turfId) {
        state.selectedTurf = { ...state.selectedTurf, ...action.payload };
      }
    },

    // Remove a turf
    removeTurf: (state, action) => {
      state.turfs = state.turfs.filter(turf => turf.turfId !== action.payload);
      if (state.selectedTurf?.turfId === action.payload) {
        state.selectedTurf = null;
      }
    },

    // Set selected turf
    setSelectedTurf: (state, action) => {
      state.selectedTurf = action.payload;
    },

    // Clear selected turf
    clearSelectedTurf: (state) => {
      state.selectedTurf = null;
    },

    // Set analytics data
    setAnalytics: (state, action) => {
      state.analytics = { ...state.analytics, ...action.payload };
    },

    // Set daily analytics
    setDailyAnalytics: (state, action) => {
      state.analytics.daily = action.payload;
    },

    // Set weekly analytics
    setWeeklyAnalytics: (state, action) => {
      state.analytics.weekly = action.payload;
    },

    // Set monthly analytics
    setMonthlyAnalytics: (state, action) => {
      state.analytics.monthly = action.payload;
    },

    // Set financial reports
    setFinancialReports: (state, action) => {
      state.financialReports = { ...state.financialReports, ...action.payload };
    },

    // Set manager performance data
    setManagerPerformance: (state, action) => {
      state.managerPerformance = action.payload;
    },

    // Set recent activities
    setRecentActivities: (state, action) => {
      state.recentActivities = action.payload;
    },

    // Add a recent activity
    addRecentActivity: (state, action) => {
      state.recentActivities.unshift(action.payload);
      // Keep only last 50 activities
      if (state.recentActivities.length > 50) {
        state.recentActivities = state.recentActivities.slice(0, 50);
      }
    },

    // Set pending actions counts
    setPendingActions: (state, action) => {
      state.pendingActions = { ...state.pendingActions, ...action.payload };
    },

    // Update specific pending action count
    updatePendingActionCount: (state, action) => {
      const { key, count } = action.payload;
      if (state.pendingActions.hasOwnProperty(key)) {
        state.pendingActions[key] = count;
      }
    },

    // Set loading state
    setOwnerLoading: (state, action) => {
      state.isLoading = action.payload;
    },

    // Set error state
    setOwnerError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Clear owner state (on logout)
    clearOwnerState: (state) => {
      return initialState;
    },
  },
});

// Export actions
export const {
  setTurfs,
  addTurf,
  updateTurf,
  removeTurf,
  setSelectedTurf,
  clearSelectedTurf,
  setAnalytics,
  setDailyAnalytics,
  setWeeklyAnalytics,
  setMonthlyAnalytics,
  setFinancialReports,
  setManagerPerformance,
  setRecentActivities,
  addRecentActivity,
  setPendingActions,
  updatePendingActionCount,
  setOwnerLoading,
  setOwnerError,
  clearOwnerState,
} = ownerSlice.actions;

// Selectors
export const selectTurfs = (state) => state.owner.turfs;
export const selectSelectedTurf = (state) => state.owner.selectedTurf;
export const selectAnalytics = (state) => state.owner.analytics;
export const selectDailyAnalytics = (state) => state.owner.analytics.daily;
export const selectWeeklyAnalytics = (state) => state.owner.analytics.weekly;
export const selectMonthlyAnalytics = (state) => state.owner.analytics.monthly;
export const selectFinancialReports = (state) => state.owner.financialReports;
export const selectManagerPerformance = (state) => state.owner.managerPerformance;
export const selectRecentActivities = (state) => state.owner.recentActivities;
export const selectPendingActions = (state) => state.owner.pendingActions;
export const selectOwnerLoading = (state) => state.owner.isLoading;
export const selectOwnerError = (state) => state.owner.error;

// Derived selectors
export const selectTotalTurfs = (state) => state.owner.turfs.length;

export const selectTotalGrounds = (state) => {
  return state.owner.turfs.reduce((total, turf) => {
    return total + (turf.totalGrounds || turf.grounds?.length || 0);
  }, 0);
};

export const selectActiveTurfs = (state) => {
  return state.owner.turfs.filter(turf => turf.isActive);
};

export const selectTurfById = (state, turfId) => {
  return state.owner.turfs.find(turf => turf.turfId === turfId);
};

export const selectTotalPendingActions = (state) => {
  const pending = state.owner.pendingActions;
  return (
    pending.bookingRequests +
    pending.unassignedCaretakers +
    pending.maintenanceIssues +
    pending.expiringAcademies
  );
};

export const selectTotalRevenue = (state) => {
  return state.owner.financialReports.revenue;
};

export const selectProfit = (state) => {
  const { revenue, expenses } = state.owner.financialReports;
  return revenue - expenses;
};

export default ownerSlice.reducer;
