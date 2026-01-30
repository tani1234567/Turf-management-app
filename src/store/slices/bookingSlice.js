import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  bookings: [],
  selectedTurf: null,
  selectedGround: null,
  selectedDate: null,
  selectedSport: null,
  selectedTimeSlots: [],
  isLoading: false,
  error: null,
};

const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    setBookings: (state, action) => {
      state.bookings = action.payload;
      state.error = null;
    },
    addBooking: (state, action) => {
      state.bookings.push(action.payload);
    },
    updateBooking: (state, action) => {
      const index = state.bookings.findIndex(
        (b) => b.bookingId === action.payload.bookingId
      );
      if (index !== -1) {
        state.bookings[index] = { ...state.bookings[index], ...action.payload };
      }
    },
    removeBooking: (state, action) => {
      state.bookings = state.bookings.filter(
        (b) => b.bookingId !== action.payload
      );
    },
    setSelectedTurf: (state, action) => {
      state.selectedTurf = action.payload;
      // Reset dependent selections when turf changes
      state.selectedGround = null;
      state.selectedSport = null;
      state.selectedTimeSlots = [];
    },
    setSelectedGround: (state, action) => {
      state.selectedGround = action.payload;
      state.selectedSport = null;
      state.selectedTimeSlots = [];
    },
    setSelectedDate: (state, action) => {
      state.selectedDate = action.payload;
      state.selectedTimeSlots = [];
    },
    setSelectedSport: (state, action) => {
      state.selectedSport = action.payload;
      state.selectedTimeSlots = [];
    },
    setSelectedTimeSlots: (state, action) => {
      state.selectedTimeSlots = action.payload;
    },
    setBookingLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setBookingError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearBookingSelection: (state) => {
      state.selectedTurf = null;
      state.selectedGround = null;
      state.selectedDate = null;
      state.selectedSport = null;
      state.selectedTimeSlots = [];
      state.error = null;
    },
  },
});

export const {
  setBookings,
  addBooking,
  updateBooking,
  removeBooking,
  setSelectedTurf,
  setSelectedGround,
  setSelectedDate,
  setSelectedSport,
  setSelectedTimeSlots,
  setBookingLoading,
  setBookingError,
  clearBookingSelection,
} = bookingSlice.actions;

// Selectors
export const selectBookings = (state) => state.booking.bookings;
export const selectSelectedTurf = (state) => state.booking.selectedTurf;
export const selectSelectedGround = (state) => state.booking.selectedGround;
export const selectSelectedDate = (state) => state.booking.selectedDate;
export const selectSelectedSport = (state) => state.booking.selectedSport;
export const selectSelectedTimeSlots = (state) => state.booking.selectedTimeSlots;
export const selectBookingLoading = (state) => state.booking.isLoading;
export const selectBookingError = (state) => state.booking.error;

// Derived selectors
export const selectUserBookings = (state, userId) =>
  state.booking.bookings.filter((b) => b.userId === userId);

export const selectBookingsByDate = (state, date) =>
  state.booking.bookings.filter((b) => b.date === date);

export const selectBookingsByStatus = (state, status) =>
  state.booking.bookings.filter((b) => b.status === status);

export default bookingSlice.reducer;
