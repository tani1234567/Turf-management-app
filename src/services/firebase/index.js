// Firebase configuration and initialization
export { default as app, auth, db, storage } from "./config";

// Authentication functions
export {
  sendOTP,
  verifyOTP,
  signOut,
  subscribeToAuthState,
  getCurrentUser,
} from "./auth";

// Firestore helpers
export {
  getDocument,
  getCollection,
  queryDocuments,
  addDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  subscribeToDocument,
  subscribeToCollection,
  serverTimestamp,
  runTransaction,
  createBookingWithTransaction,
} from "./firestore";

// Chat functions
export {
  getOrCreateChat,
  sendMessage,
  sendNegotiationCard,
  updateNegotiationStatus,
  markAsRead,
  listenToMessages,
  listenToUserChats,
  listenToCompanyChats,
  getChat,
  getUserUnreadCount,
  getCompanyUnreadCount,
  sendBookingCard,
  updateBookingCardStatus,
  sendLocationMessage,
} from "./chat";

// Booking functions
export {
  checkSlotAvailability,
  createBookingFromNegotiation,
  createPendingBooking,
  confirmPendingBooking,
  expireConflictingNegotiations,
  getBooking,
} from "./booking";
