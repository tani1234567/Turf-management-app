import { createSlice, createSelector } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.error = null;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
      state.isLoading = false;
    },
    updateUserProfile: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const { setUser, setLoading, setError, logout, updateUserProfile } =
  authSlice.actions;

// Selectors
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.isLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectUserRole = (state) => state.auth.user?.role;

// V2 Role-specific selectors
export const selectIsUser = (state) => state.auth.user?.role === 'user';
export const selectIsOwner = (state) => state.auth.user?.role === 'owner';
export const selectIsManager = (state) => state.auth.user?.role === 'manager';
export const selectIsCaretaker = (state) => state.auth.user?.role === 'caretaker';
export const selectIsAdmin = (state) => state.auth.user?.role === 'admin';

// Company-related selectors
export const selectUserCompanyId = (state) => state.auth.user?.companyId;

// Owner-specific selectors
export const selectHasOperationalPermissions = (state) =>
  state.auth.user?.role === 'owner' && state.auth.user?.hasOperationalPermissions === true;
// Input selector is the full user object so the result function extracts a
// different value — avoids the reselect v5 "identity function" warning that
// fires (and causes infinite re-render loops) when result === input[0].
export const selectManagedTurfIds = createSelector(
  (state) => state.auth.user,
  (user) => user?.managedTurfIds ?? []
);

// Manager-specific selectors
export const selectAssignedTurfIds = createSelector(
  (state) => state.auth.user,
  (user) => user?.assignedTurfIds ?? []
);
export const selectSelectedTurfId = (state) => state.auth.user?.selectedTurfId;

// Caretaker-specific selectors
export const selectAssignedTurfId = (state) => state.auth.user?.assignedTurfId;
export const selectIsCaretakerAssigned = (state) =>
  state.auth.user?.role === 'caretaker' && state.auth.user?.isAssigned === true;

// Suspension selectors
export const selectIsSuspended = (state) => state.auth.user?.isSuspended === true;
export const selectSuspensionInfo = createSelector(
  (state) => state.auth.user?.isSuspended,
  (state) => state.auth.user?.suspendedAt,
  (state) => state.auth.user?.suspendedBy,
  (state) => state.auth.user?.suspensionReason,
  (state) => state.auth.user?.canBeDeletedAfter,
  (isSuspended, suspendedAt, suspendedBy, suspensionReason, canBeDeletedAfter) => ({
    isSuspended,
    suspendedAt,
    suspendedBy,
    suspensionReason,
    canBeDeletedAfter,
  })
);

// Check if user can perform manager tasks (owner with permissions OR manager)
export const selectCanPerformManagerTasks = (state) => {
  const role = state.auth.user?.role;
  if (role === 'manager') return true;
  if (role === 'owner' && state.auth.user?.hasOperationalPermissions) return true;
  return false;
};

export default authSlice.reducer;
