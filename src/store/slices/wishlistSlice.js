import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getDocument, updateDocument } from "../../services/firebase/firestore";

export const loadWishlist = createAsyncThunk(
  "wishlist/load",
  async (userId) => {
    const userData = await getDocument("users", userId);
    return userData?.wishlistedTurfIds || [];
  }
);

export const toggleWishlistItem = createAsyncThunk(
  "wishlist/toggle",
  async ({ userId, turfId }, { getState }) => {
    const current = getState().wishlist.turfIds;
    const newIds = current.includes(turfId)
      ? current.filter((id) => id !== turfId)
      : [...current, turfId];
    await updateDocument("users", userId, { wishlistedTurfIds: newIds });
    return newIds;
  }
);

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState: {
    turfIds: [],
    loading: false,
  },
  reducers: {
    clearWishlist: (state) => {
      state.turfIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadWishlist.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadWishlist.fulfilled, (state, action) => {
        state.turfIds = action.payload;
        state.loading = false;
      })
      .addCase(loadWishlist.rejected, (state) => {
        state.loading = false;
      })
      .addCase(toggleWishlistItem.fulfilled, (state, action) => {
        state.turfIds = action.payload;
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;

export const selectWishlistIds = (state) => state.wishlist.turfIds;
export const selectWishlistLoading = (state) => state.wishlist.loading;
export const selectIsWishlisted = (turfId) => (state) =>
  state.wishlist.turfIds.includes(turfId);

export default wishlistSlice.reducer;
