import { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import {
  setUser,
  setLoading,
  setError,
  logout as logoutAction,
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
  selectUserRole,
} from "../store/slices/authSlice";
import { setCompany, clearCompany } from "../store/slices/companySlice";
import { clearWishlist } from "../store/slices/wishlistSlice";
import { clearOwnerState } from "../store/slices/ownerSlice";
import { getDocument } from "../services/firebase/firestore";
import { getPushToken, removeFCMToken } from "../services/notifications/setup";

// Import appropriate auth based on platform
let subscribeToAuthState, signOutFunc;

if (Platform.OS === "web") {
  // Web: Use Firebase JS SDK
  const firebaseAuth = require("../services/firebase/auth");
  subscribeToAuthState = firebaseAuth.subscribeToAuthState;
  signOutFunc = firebaseAuth.signOut;
} else {
  // Native: Use @react-native-firebase/auth
  try {
    const nativeAuth = require("@react-native-firebase/auth").default;
    subscribeToAuthState = (callback) => {
      return nativeAuth().onAuthStateChanged(callback);
    };
    signOutFunc = () => nativeAuth().signOut();
  } catch (e) {
    // Fallback to web SDK if native not available
    const firebaseAuth = require("../services/firebase/auth");
    subscribeToAuthState = firebaseAuth.subscribeToAuthState;
    signOutFunc = firebaseAuth.signOut;
  }
}

/**
 * Custom hook for authentication state and actions
 */
export const useAuth = (options = {}) => {
  const shouldSubscribe = options.subscribe === true;
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const userRole = useAppSelector(selectUserRole);

  // Subscribe to auth state changes on mount
  useEffect(() => {
    if (!shouldSubscribe) {
      return undefined;
    }

    dispatch(setLoading(true));

    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      console.log("[useAuth] Auth state changed:", firebaseUser?.uid || "null");

      if (firebaseUser) {
        try {
          // Fetch user data from Firestore
          const userData = await getDocument("users", firebaseUser.uid);

          if (userData && userData.role) {
            // Existing user with complete profile
            console.log("[useAuth] Existing user found:", userData.role);
            console.log("[useAuth] User data:", JSON.stringify(userData, null, 2));
            console.log("[useAuth] assignedTurfId:", userData.assignedTurfId);
            console.log("[useAuth] isAssigned:", userData.isAssigned);
            dispatch(setUser(userData));

            // If user has a companyId, fetch company data
            if (userData.companyId) {
              console.log("[useAuth] Fetching company:", userData.companyId);
              try {
                const companyData = await getDocument("companies", userData.companyId);
                if (companyData) {
                  // Include the document ID as companyId
                  dispatch(setCompany({
                    ...companyData,
                    companyId: userData.companyId,
                    id: userData.companyId
                  }));
                  console.log("[useAuth] Company loaded:", companyData.name);
                }
              } catch (companyErr) {
                console.error("[useAuth] Error fetching company:", companyErr);
              }
            }
          } else {
            // User exists in Firebase Auth but not in Firestore (new user)
            // OR user hasn't completed profile setup
            console.log("[useAuth] New user or incomplete profile");
            dispatch(
              setUser({
                userId: firebaseUser.uid,
                phone: firebaseUser.phoneNumber,
                isNewUser: true,
              })
            );
          }
        } catch (err) {
          console.error("[useAuth] Error fetching user data:", err);
          dispatch(setError(err.message));
        }
      } else {
        console.log("[useAuth] No user, clearing state");
        dispatch(setUser(null));
        dispatch(clearCompany());
      }
      dispatch(setLoading(false));
    });

    return () => unsubscribe();
  }, [dispatch, shouldSubscribe]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      // Clean up FCM token before signing out (best-effort)
      if (Platform.OS !== "web") {
        try {
          const token = await getPushToken();
          if (token && user?.userId) await removeFCMToken(user.userId, token);
        } catch (_) {}
      }
      await signOutFunc();
      dispatch(logoutAction());
      dispatch(clearCompany());
      dispatch(clearWishlist());
      dispatch(clearOwnerState());
    } catch (err) {
      dispatch(setError(err.message));
    }
  }, [dispatch, user]);

  // Check if user has specific role
  const hasRole = useCallback(
    (role) => {
      return userRole === role;
    },
    [userRole]
  );

  // Check if user is manager
  const isManager = userRole === "manager";

  // Check if user is caretaker
  const isCaretaker = userRole === "caretaker";

  // Check if user is admin
  const isAdmin = userRole === "admin";

  // Check if user is regular user
  const isUser = userRole === "user";

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    userRole,
    logout,
    hasRole,
    isManager,
    isCaretaker,
    isAdmin,
    isUser,
  };
};

export default useAuth;
