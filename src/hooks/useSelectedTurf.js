import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "./useAppSelector";
import { useAppDispatch } from "./useAppDispatch";
import {
  selectUser,
  selectAssignedTurfIds,
  selectSelectedTurfId,
  updateUserProfile,
} from "../store/slices/authSlice";
import {
  getDocument,
  updateDocument,
  subscribeToDocument,
} from "../services/firebase/firestore";

/**
 * Custom hook for managing the selected turf for managers.
 *
 * - Listens to the selected turf document in real-time
 * - Provides a changeTurf function that persists to Firestore + Redux
 * - Returns turf data, loading state, and whether the manager has multiple turfs
 * - Auto-selects the single turf if only one is assigned
 */
export function useSelectedTurf() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const assignedTurfIds = useAppSelector(selectAssignedTurfIds);
  const persistedTurfId = useAppSelector(selectSelectedTurfId);

  const [selectedTurfId, setSelectedTurfId] = useState(persistedTurfId || null);
  const [turfData, setTurfData] = useState(null);
  const [allTurfs, setAllTurfs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const hasMultipleTurfs = assignedTurfIds.length > 1;

  // Auto-select single turf or restore persisted selection
  useEffect(() => {
    if (!assignedTurfIds || assignedTurfIds.length === 0) {
      setSelectedTurfId(null);
      setTurfData(null);
      setIsLoading(false);
      return;
    }

    if (persistedTurfId && assignedTurfIds.includes(persistedTurfId)) {
      setSelectedTurfId(persistedTurfId);
    } else if (assignedTurfIds.length === 1) {
      // Auto-select the only assigned turf
      const singleId = assignedTurfIds[0];
      setSelectedTurfId(singleId);
      persistSelection(singleId);
    } else {
      // Multiple turfs but no valid persisted selection
      setSelectedTurfId(assignedTurfIds[0]);
    }
  }, [assignedTurfIds, persistedTurfId]);

  // Load all assigned turfs metadata
  useEffect(() => {
    if (!assignedTurfIds || assignedTurfIds.length === 0) {
      setAllTurfs([]);
      return;
    }

    const loadAllTurfs = async () => {
      try {
        const promises = assignedTurfIds.map((id) => getDocument("turfs", id));
        const results = await Promise.all(promises);
        setAllTurfs(results.filter(Boolean));
      } catch (error) {
        console.error("[useSelectedTurf] Error loading turfs:", error);
      }
    };

    loadAllTurfs();
  }, [assignedTurfIds]);

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
      if (!turfId || !assignedTurfIds.includes(turfId)) return;
      setSelectedTurfId(turfId);
      await persistSelection(turfId);
    },
    [assignedTurfIds, persistSelection]
  );

  return {
    /** Currently selected turf document data (real-time) */
    turfData,
    /** Currently selected turf ID */
    selectedTurfId,
    /** All assigned turf documents */
    allTurfs,
    /** Array of assigned turf IDs */
    assignedTurfIds,
    /** Whether the manager has more than one assigned turf */
    hasMultipleTurfs,
    /** Whether turf data is still loading */
    isLoading,
    /** Change the selected turf */
    changeTurf,
  };
}

export default useSelectedTurf;
