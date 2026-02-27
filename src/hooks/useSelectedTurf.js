import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "./useAppSelector";
import { useAppDispatch } from "./useAppDispatch";
import {
  selectUser,
  selectUserRole,
  selectAssignedTurfIds,
  selectManagedTurfIds,
  selectSelectedTurfId,
  updateUserProfile,
} from "../store/slices/authSlice";
import { selectCompany } from "../store/slices/companySlice";
import {
  getDocument,
  updateDocument,
  subscribeToDocument,
  queryDocuments,
} from "../services/firebase/firestore";

/**
 * Custom hook for managing the selected turf for managers and owners.
 *
 * - For managers: uses assignedTurfIds from user profile
 * - For owners: uses managedTurfIds (if set) or queries all company turfs
 * - Listens to the selected turf document in real-time
 * - Provides a changeTurf function that persists to Firestore + Redux
 * - Returns turf data, loading state, and whether the user has multiple turfs
 * - Auto-selects the single turf if only one is available
 */
export function useSelectedTurf() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const role = useAppSelector(selectUserRole);
  const assignedTurfIds = useAppSelector(selectAssignedTurfIds);
  const managedTurfIds = useAppSelector(selectManagedTurfIds);
  const persistedTurfId = useAppSelector(selectSelectedTurfId);
  const company = useAppSelector(selectCompany);

  const [ownerTurfIds, setOwnerTurfIds] = useState([]);
  const [selectedTurfId, setSelectedTurfId] = useState(persistedTurfId || null);
  const [turfData, setTurfData] = useState(null);
  const [allTurfs, setAllTurfs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve owner turf IDs
  useEffect(() => {
    if (role !== "owner") return;

    const companyId = company?.companyId || company?.id;
    if (!companyId) {
      setOwnerTurfIds([]);
      return;
    }

    if (managedTurfIds && managedTurfIds.length > 0) {
      // Owner selected specific turfs in Operational Settings
      setOwnerTurfIds(managedTurfIds);
    } else {
      // managedTurfIds is empty → means "All turfs" — query all company turfs
      const loadCompanyTurfs = async () => {
        try {
          const turfs = await queryDocuments("turfs", [
            { field: "companyId", operator: "==", value: companyId },
          ]);
          setOwnerTurfIds(turfs.map((t) => t.id || t.turfId));
        } catch (error) {
          console.error("[useSelectedTurf] Error loading owner turfs:", error);
          setOwnerTurfIds([]);
        }
      };
      loadCompanyTurfs();
    }
  }, [role, managedTurfIds, company?.companyId, company?.id]);

  // Compute effective turf IDs based on role
  const effectiveTurfIds = role === "owner" ? ownerTurfIds : assignedTurfIds;

  const hasMultipleTurfs = effectiveTurfIds.length > 1;

  // Auto-select single turf or restore persisted selection
  useEffect(() => {
    if (!effectiveTurfIds || effectiveTurfIds.length === 0) {
      setSelectedTurfId(null);
      setTurfData(null);
      setIsLoading(false);
      return;
    }

    if (persistedTurfId && effectiveTurfIds.includes(persistedTurfId)) {
      setSelectedTurfId(persistedTurfId);
    } else if (effectiveTurfIds.length === 1) {
      // Auto-select the only turf
      const singleId = effectiveTurfIds[0];
      setSelectedTurfId(singleId);
      persistSelection(singleId);
    } else {
      // Multiple turfs but no valid persisted selection
      setSelectedTurfId(effectiveTurfIds[0]);
    }
  }, [effectiveTurfIds, persistedTurfId]);

  // Load all turf metadata
  useEffect(() => {
    if (!effectiveTurfIds || effectiveTurfIds.length === 0) {
      setAllTurfs([]);
      return;
    }

    const loadAllTurfs = async () => {
      try {
        const promises = effectiveTurfIds.map((id) => getDocument("turfs", id));
        const results = await Promise.all(promises);
        setAllTurfs(results.filter(Boolean));
      } catch (error) {
        console.error("[useSelectedTurf] Error loading turfs:", error);
      }
    };

    loadAllTurfs();
  }, [effectiveTurfIds]);

  // Subscribe to selected turf document for real-time updates
  useEffect(() => {
    if (!selectedTurfId) {
      setTurfData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = subscribeToDocument("turfs", selectedTurfId, (data) => {
      setTurfData(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedTurfId]);

  // Persist turf selection to Firestore and Redux
  const persistSelection = useCallback(
    async (turfId) => {
      if (!user?.userId) return;
      try {
        await updateDocument("users", user.userId, {
          selectedTurfId: turfId,
        });
        dispatch(updateUserProfile({ selectedTurfId: turfId }));
      } catch (error) {
        console.error("[useSelectedTurf] Error persisting selection:", error);
      }
    },
    [user?.userId, dispatch]
  );

  /**
   * Change the active turf and persist the selection
   * @param {string} turfId - The turf ID to switch to
   */
  const changeTurf = useCallback(
    async (turfId) => {
      if (!turfId || !effectiveTurfIds.includes(turfId)) return;
      setSelectedTurfId(turfId);
      await persistSelection(turfId);
    },
    [effectiveTurfIds, persistSelection]
  );

  return {
    /** Currently selected turf document data (real-time) */
    turfData,
    /** Currently selected turf ID */
    selectedTurfId,
    /** All turf documents available to this user */
    allTurfs,
    /** Array of effective turf IDs (assigned for managers, managed for owners) */
    assignedTurfIds: effectiveTurfIds,
    /** Whether the user has more than one available turf */
    hasMultipleTurfs,
    /** Whether turf data is still loading */
    isLoading,
    /** Change the selected turf */
    changeTurf,
  };
}

export default useSelectedTurf;
