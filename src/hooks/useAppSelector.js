import { useSelector } from "react-redux";

/**
 * Custom hook for selecting state from Redux store
 * Use this instead of plain useSelector for consistency
 */
export const useAppSelector = useSelector;

export default useAppSelector;
