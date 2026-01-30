import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";

/**
 * Custom hook for checking user permissions based on role and operational settings
 *
 * Owners can optionally enable operational permissions to participate in day-to-day operations.
 * When enabled, they can:
 * - Approve/reject booking requests
 * - Respond to customer chats
 * - Create and manage academies
 * - Block time slots
 * - Assign caretakers to turfs
 * - Track expenses (add/edit)
 *
 * Managers always have operational permissions for their assigned turfs.
 */
export function usePermissions() {
  const user = useSelector(selectUser);

  /**
   * Check if user can approve/reject bookings
   */
  const canApproveBookings = () => {
    if (!user) return false;
    if (user.role === "manager") return true;
    if (user.role === "owner" && user.hasOperationalPermissions) return true;
    return false;
  };

  /**
   * Check if user can manage a specific turf
   * @param {string} turfId - The turf ID to check
   */
  const canManageTurf = (turfId) => {
    if (!user || !turfId) return false;

    if (user.role === "manager") {
      return user.assignedTurfIds?.includes(turfId);
    }

    if (user.role === "owner" && user.hasOperationalPermissions) {
      // Empty managedTurfIds means all turfs
      return (
        !user.managedTurfIds ||
        user.managedTurfIds.length === 0 ||
        user.managedTurfIds.includes(turfId)
      );
    }

    return false;
  };

  /**
   * Check if user can access chat functionality
   */
  const canAccessChat = () => {
    if (!user) return false;
    return (
      user.role === "manager" ||
      (user.role === "owner" && user.hasOperationalPermissions)
    );
  };

  /**
   * Check if user can create/manage academies
   */
  const canCreateAcademy = () => {
    if (!user) return false;
    return (
      user.role === "manager" ||
      (user.role === "owner" && user.hasOperationalPermissions)
    );
  };

  /**
   * Check if user can block time slots
   */
  const canBlockSlots = () => {
    if (!user) return false;
    return (
      user.role === "manager" ||
      (user.role === "owner" && user.hasOperationalPermissions)
    );
  };

  /**
   * Check if user can assign caretakers to turfs
   */
  const canAssignCaretakers = () => {
    if (!user) return false;
    return (
      user.role === "manager" ||
      (user.role === "owner" && user.hasOperationalPermissions)
    );
  };

  /**
   * Check if user can add/edit expenses (not just view)
   */
  const canEditExpenses = () => {
    if (!user) return false;
    return (
      user.role === "manager" ||
      (user.role === "owner" && user.hasOperationalPermissions)
    );
  };

  /**
   * Check if user has operational permissions enabled
   */
  const hasOperationalPermissions = () => {
    if (!user) return false;
    if (user.role === "manager") return true;
    return user.role === "owner" && user.hasOperationalPermissions === true;
  };

  /**
   * Get list of turf IDs the user can manage
   * Returns null if user can manage all turfs
   */
  const getManagedTurfIds = () => {
    if (!user) return [];

    if (user.role === "manager") {
      return user.assignedTurfIds || [];
    }

    if (user.role === "owner" && user.hasOperationalPermissions) {
      // Empty or undefined means all turfs
      if (!user.managedTurfIds || user.managedTurfIds.length === 0) {
        return null; // null indicates all turfs
      }
      return user.managedTurfIds;
    }

    return [];
  };

  /**
   * Check if user is owner (regardless of operational permissions)
   */
  const isOwner = () => {
    return user?.role === "owner";
  };

  /**
   * Check if user is manager
   */
  const isManager = () => {
    return user?.role === "manager";
  };

  /**
   * Check if user is caretaker
   */
  const isCaretaker = () => {
    return user?.role === "caretaker";
  };

  return {
    canApproveBookings,
    canManageTurf,
    canAccessChat,
    canCreateAcademy,
    canBlockSlots,
    canAssignCaretakers,
    canEditExpenses,
    hasOperationalPermissions,
    getManagedTurfIds,
    isOwner,
    isManager,
    isCaretaker,
  };
}

export default usePermissions;
