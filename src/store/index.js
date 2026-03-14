import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import bookingReducer from "./slices/bookingSlice";
import companyReducer from "./slices/companySlice";
import ownerReducer from "./slices/ownerSlice";
import wishlistReducer from "./slices/wishlistSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    booking: bookingReducer,
    company: companyReducer,
    owner: ownerReducer,
    wishlist: wishlistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Export store types for hooks
export default store;
