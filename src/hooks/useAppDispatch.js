import { useDispatch } from "react-redux";

/**
 * Custom hook for dispatching Redux actions
 * Use this instead of plain useDispatch for consistency
 */
export const useAppDispatch = () => useDispatch();

export default useAppDispatch;
