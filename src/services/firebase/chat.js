import { Platform } from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp as webServerTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "./config";

// Always use the web Firebase SDK for Firestore so it shares the same auth
// context as the web SDK auth instance (AsyncStorage-backed). The native
// @react-native-firebase/firestore SDK has its own separate auth context
// which causes permission-denied errors when auth lives in the web SDK.
const nativeFirestore = null;
const hasNativeFirestore = false;

const serverTimestamp = () => {
  if (hasNativeFirestore) {
    return nativeFirestore.FieldValue.serverTimestamp();
  }
  return webServerTimestamp();
};

const incrementValue = (n) => {
  if (hasNativeFirestore) {
    return nativeFirestore.FieldValue.increment(n);
  }
  return increment(n);
};

/**
 * Get or create a chat between a user and a company
 * @param {string} userId - The user's ID
 * @param {string} companyId - The company's ID
 * @param {object} userData - User data (name, phone, avatar)
 * @param {object} companyData - Company data (name, avatar, turfManagerIds)
 * @returns {Promise<object>} - Chat document with ID
 */
export const getOrCreateChat = async (userId, companyId, userData = {}, companyData = {}) => {
  try {
    // First, try to find existing chat
    if (hasNativeFirestore) {
      const existingChats = await nativeFirestore()
        .collection("chats")
        .where("participants.user.userId", "==", userId)
        .where("participants.company.companyId", "==", companyId)
        .get();

      if (!existingChats.empty) {
        const chatDoc = existingChats.docs[0];
        return { id: chatDoc.id, ...chatDoc.data() };
      }

      // Create new chat
      const newChatData = {
        participants: {
          user: {
            userId,
            name: userData.name || "User",
            phone: userData.phone || "",
            avatar: userData.avatar || null,
          },
          company: {
            companyId,
            name: companyData.name || "Company",
            avatar: companyData.avatar || null,
            turfManagerIds: companyData.turfManagerIds || [],
          },
        },
        lastMessage: null,
        unreadCount: {
          [userId]: 0,
          company: 0,
        },
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const chatRef = await nativeFirestore().collection("chats").add(newChatData);
      return { id: chatRef.id, ...newChatData };
    }

    // Web SDK
    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef,
      where("participants.user.userId", "==", userId),
      where("participants.company.companyId", "==", companyId)
    );
    const existingChats = await getDocs(q);

    if (!existingChats.empty) {
      const chatDoc = existingChats.docs[0];
      return { id: chatDoc.id, ...chatDoc.data() };
    }

    // Create new chat
    const newChatData = {
      participants: {
        user: {
          userId,
          name: userData.name || "User",
          phone: userData.phone || "",
          avatar: userData.avatar || null,
        },
        company: {
          companyId,
          name: companyData.name || "Company",
          avatar: companyData.avatar || null,
          turfManagerIds: companyData.turfManagerIds || [],
        },
      },
      lastMessage: null,
      unreadCount: {
        [userId]: 0,
        company: 0,
      },
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const chatRef = await addDoc(chatsRef, newChatData);
    return { id: chatRef.id, ...newChatData };
  } catch (error) {
    console.error("Error getting/creating chat:", error);
    throw error;
  }
};

/**
 * Send a text message to a chat
 * @param {string} chatId - Chat ID
 * @param {object} message - Message object { text, senderId, senderType, senderName }
 * @returns {Promise<string>} - Message ID
 */
export const sendMessage = async (chatId, message) => {
  try {
    const messageData = {
      type: "text",
      text: message.text,
      senderId: message.senderId,
      senderType: message.senderType, // "user" | "manager"
      senderName: message.senderName,
      timestamp: serverTimestamp(),
      read: false,
    };

    if (hasNativeFirestore) {
      // Add message to subcollection
      const messageRef = await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .add(messageData);

      // Update chat with last message and unread count
      const unreadField = message.senderType === "user" ? "unreadCount.company" : `unreadCount.${message.senderId}`;
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          lastMessage: {
            text: message.text,
            senderId: message.senderId,
            senderType: message.senderType,
            timestamp: serverTimestamp(),
            type: "text",
          },
          [unreadField]: incrementValue(1),
          updatedAt: serverTimestamp(),
        });

      return messageRef.id;
    }

    // Web SDK
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messageRef = await addDoc(messagesRef, messageData);

    // Update chat with last message
    const chatRef = doc(db, "chats", chatId);
    const unreadField = message.senderType === "user" ? "unreadCount.company" : `unreadCount.${message.senderId}`;
    await updateDoc(chatRef, {
      lastMessage: {
        text: message.text,
        senderId: message.senderId,
        senderType: message.senderType,
        timestamp: serverTimestamp(),
        type: "text",
      },
      [unreadField]: increment(1),
      updatedAt: serverTimestamp(),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

/**
 * Send a negotiation card to a chat
 * @param {string} chatId - Chat ID
 * @param {object} negotiationData - Negotiation details
 * @returns {Promise<string>} - Message ID
 */
export const sendNegotiationCard = async (chatId, negotiationData) => {
  try {
    const messageData = {
      type: "negotiation_card",
      senderId: negotiationData.senderId,
      senderType: negotiationData.senderType,
      senderName: negotiationData.senderName,
      negotiationCard: {
        // Turf/Ground info
        turfId: negotiationData.turfId,
        turfName: negotiationData.turfName,
        groundId: negotiationData.groundId,
        groundName: negotiationData.groundName,
        companyId: negotiationData.companyId || null,

        // Booking details
        sport: negotiationData.sport,
        date: negotiationData.date,
        startTime: negotiationData.startTime,
        endTime: negotiationData.endTime,
        duration: negotiationData.duration || null,

        // Pricing
        originalPrice: negotiationData.originalPrice,
        requestedPrice: negotiationData.requestedPrice,
        isNegotiation: negotiationData.isNegotiation || false,

        // Sender info (needed when creating booking)
        senderId: negotiationData.senderId,
        senderName: negotiationData.senderName,
        senderType: negotiationData.senderType,
        senderPhone: negotiationData.senderPhone || "",
        senderEmail: negotiationData.senderEmail || "",

        // Status
        status: "pending", // pending | accepted | rejected | countered | expired
        message: negotiationData.message || "",
        counterPrice: null,
        respondedBy: null,
        respondedByName: null,
        respondedAt: null,
      },
      timestamp: serverTimestamp(),
      read: false,
    };

    if (hasNativeFirestore) {
      const messageRef = await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .add(messageData);

      // Update chat with last message
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          lastMessage: {
            text: `Booking request for ${negotiationData.turfName}`,
            senderId: negotiationData.senderId,
            senderType: negotiationData.senderType,
            timestamp: serverTimestamp(),
            type: "negotiation_card",
          },
          "unreadCount.company": incrementValue(1),
          hasActiveNegotiation: true,
          updatedAt: serverTimestamp(),
        });

      return messageRef.id;
    }

    // Web SDK
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messageRef = await addDoc(messagesRef, messageData);

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      lastMessage: {
        text: `Booking request for ${negotiationData.turfName}`,
        senderId: negotiationData.senderId,
        senderType: negotiationData.senderType,
        timestamp: serverTimestamp(),
        type: "negotiation_card",
      },
      "unreadCount.company": increment(1),
      hasActiveNegotiation: true,
      updatedAt: serverTimestamp(),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending negotiation card:", error);
    throw error;
  }
};

/**
 * Update negotiation status (accept/reject/counter)
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} status - New status (accepted | rejected | countered | expired)
 * @param {object} updateData - Additional update data (counterPrice, respondedBy, etc.)
 * @returns {Promise<void>}
 */
export const updateNegotiationStatus = async (chatId, messageId, status, updateData = {}) => {
  try {
    const updates = {
      "negotiationCard.status": status,
      "negotiationCard.respondedAt": serverTimestamp(),
      ...Object.keys(updateData).reduce((acc, key) => {
        acc[`negotiationCard.${key}`] = updateData[key];
        return acc;
      }, {}),
    };

    if (hasNativeFirestore) {
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .doc(messageId)
        .update(updates);

      // Update chat to reflect negotiation status change
      const statusText = {
        accepted: "Booking request accepted",
        rejected: "Booking request rejected",
        countered: `Counter offer: ₹${updateData.counterPrice}`,
        expired: "Booking request expired",
      };

      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          "lastMessage.text": statusText[status] || "Negotiation updated",
          hasActiveNegotiation: status === "pending" || status === "countered",
          updatedAt: serverTimestamp(),
        });

      return;
    }

    // Web SDK
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    await updateDoc(messageRef, updates);

    const statusText = {
      accepted: "Booking request accepted",
      rejected: "Booking request rejected",
      countered: `Counter offer: ₹${updateData.counterPrice}`,
      expired: "Booking request expired",
    };

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      "lastMessage.text": statusText[status] || "Negotiation updated",
      hasActiveNegotiation: status === "pending" || status === "countered",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating negotiation status:", error);
    throw error;
  }
};

/**
 * Mark messages as read for a user
 * @param {string} chatId - Chat ID
 * @param {string} viewerId - The ID of the user viewing the chat
 * @param {string} viewerType - "user" | "manager"
 * @returns {Promise<void>}
 */
export const markAsRead = async (chatId, viewerId, viewerType) => {
  try {
    // Reset unread count for the viewer
    const unreadField = viewerType === "user" ? `unreadCount.${viewerId}` : "unreadCount.company";

    if (hasNativeFirestore) {
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          [unreadField]: 0,
          updatedAt: serverTimestamp(),
        });
      return;
    }

    // Web SDK
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      [unreadField]: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
};

/**
 * Listen to messages in a chat (real-time)
 * @param {string} chatId - Chat ID
 * @param {function} callback - Callback receiving array of messages
 * @returns {function} - Unsubscribe function
 */
export const listenToMessages = (chatId, callback) => {
  if (hasNativeFirestore) {
    return nativeFirestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .onSnapshot(
        (snapshot) => {
          const messages = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date(),
          }));
          callback(messages);
        },
        (error) => {
          console.error("Error listening to messages:", error);
          callback([]);
        }
      );
  }

  // Web SDK
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(),
      }));
      callback(messages);
    },
    (error) => {
      console.error("Error listening to messages:", error);
      callback([]);
    }
  );
};

/**
 * Listen to all chats for a user (real-time)
 * @param {string} userId - User ID
 * @param {function} callback - Callback receiving array of chats
 * @returns {function} - Unsubscribe function
 */
export const listenToUserChats = (userId, callback) => {
  console.log("[listenToUserChats] Starting listener for userId:", userId);

  if (!userId) {
    console.warn("[listenToUserChats] No userId provided");
    callback([]);
    return () => {};
  }

  if (hasNativeFirestore) {
    // Simplified query without orderBy to avoid composite index requirement
    return nativeFirestore()
      .collection("chats")
      .where("participants.user.userId", "==", userId)
      .onSnapshot(
        (snapshot) => {
          console.log("[listenToUserChats] Native: Got", snapshot.docs.length, "chats");
          const chats = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
              createdAt: doc.data().createdAt?.toDate?.() || new Date(),
            }))
            .filter((chat) => chat.status === "active")
            .sort((a, b) => b.updatedAt - a.updatedAt);
          callback(chats);
        },
        (error) => {
          console.error("[listenToUserChats] Native error:", error);
          callback([]);
        }
      );
  }

  // Web SDK - Simplified query without orderBy to avoid composite index requirement
  const chatsRef = collection(db, "chats");
  const q = query(
    chatsRef,
    where("participants.user.userId", "==", userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      console.log("[listenToUserChats] Web: Got", snapshot.docs.length, "chats");
      const chats = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        }))
        .filter((chat) => chat.status === "active")
        .sort((a, b) => b.updatedAt - a.updatedAt);
      callback(chats);
    },
    (error) => {
      console.error("[listenToUserChats] Web error:", error);
      callback([]);
    }
  );
};

/**
 * Listen to all chats for a company (real-time)
 * @param {string} companyId - Company ID
 * @param {function} callback - Callback receiving array of chats
 * @returns {function} - Unsubscribe function
 */
export const listenToCompanyChats = (companyId, callback) => {
  console.log("[listenToCompanyChats] Starting listener for companyId:", companyId);

  if (!companyId) {
    console.warn("[listenToCompanyChats] No companyId provided");
    callback([]);
    return () => {};
  }

  if (hasNativeFirestore) {
    // Simplified query without orderBy to avoid composite index requirement
    // Sort client-side instead
    return nativeFirestore()
      .collection("chats")
      .where("participants.company.companyId", "==", companyId)
      .onSnapshot(
        (snapshot) => {
          console.log("[listenToCompanyChats] Native: Got", snapshot.docs.length, "chats");
          const chats = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
              createdAt: doc.data().createdAt?.toDate?.() || new Date(),
            }))
            .filter((chat) => chat.status === "active")
            .sort((a, b) => b.updatedAt - a.updatedAt);
          callback(chats);
        },
        (error) => {
          console.error("[listenToCompanyChats] Native error:", error);
          callback([]);
        }
      );
  }

  // Web SDK - Simplified query without orderBy to avoid composite index requirement
  const chatsRef = collection(db, "chats");
  const q = query(
    chatsRef,
    where("participants.company.companyId", "==", companyId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      console.log("[listenToCompanyChats] Web: Got", snapshot.docs.length, "chats");
      const chats = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        }))
        .filter((chat) => chat.status === "active")
        .sort((a, b) => b.updatedAt - a.updatedAt);
      callback(chats);
    },
    (error) => {
      console.error("[listenToCompanyChats] Web error:", error);
      callback([]);
    }
  );
};

/**
 * Get a single chat by ID
 * @param {string} chatId - Chat ID
 * @returns {Promise<object|null>} - Chat document or null
 */
export const getChat = async (chatId) => {
  try {
    if (hasNativeFirestore) {
      const chatDoc = await nativeFirestore().collection("chats").doc(chatId).get();
      if (chatDoc.exists) {
        return { id: chatDoc.id, ...chatDoc.data() };
      }
      return null;
    }

    // Web SDK
    const chatRef = doc(db, "chats", chatId);
    const chatDoc = await getDoc(chatRef);
    if (chatDoc.exists()) {
      return { id: chatDoc.id, ...chatDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting chat:", error);
    throw error;
  }
};

/**
 * Get total unread count for a user across all chats
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Total unread count
 */
export const getUserUnreadCount = async (userId) => {
  try {
    if (hasNativeFirestore) {
      const chats = await nativeFirestore()
        .collection("chats")
        .where("participants.user.userId", "==", userId)
        .where("status", "==", "active")
        .get();

      let totalUnread = 0;
      chats.docs.forEach((doc) => {
        const data = doc.data();
        totalUnread += data.unreadCount?.[userId] || 0;
      });
      return totalUnread;
    }

    // Web SDK
    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef,
      where("participants.user.userId", "==", userId),
      where("status", "==", "active")
    );
    const chats = await getDocs(q);

    let totalUnread = 0;
    chats.docs.forEach((doc) => {
      const data = doc.data();
      totalUnread += data.unreadCount?.[userId] || 0;
    });
    return totalUnread;
  } catch (error) {
    console.error("Error getting user unread count:", error);
    return 0;
  }
};

/**
 * Get total unread count for a company across all chats
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} - Total unread count
 */
export const getCompanyUnreadCount = async (companyId) => {
  try {
    if (hasNativeFirestore) {
      const chats = await nativeFirestore()
        .collection("chats")
        .where("participants.company.companyId", "==", companyId)
        .where("status", "==", "active")
        .get();

      let totalUnread = 0;
      chats.docs.forEach((doc) => {
        const data = doc.data();
        totalUnread += data.unreadCount?.company || 0;
      });
      return totalUnread;
    }

    // Web SDK
    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef,
      where("participants.company.companyId", "==", companyId),
      where("status", "==", "active")
    );
    const chats = await getDocs(q);

    let totalUnread = 0;
    chats.docs.forEach((doc) => {
      const data = doc.data();
      totalUnread += data.unreadCount?.company || 0;
    });
    return totalUnread;
  } catch (error) {
    console.error("Error getting company unread count:", error);
    return 0;
  }
};

/**
 * Send a booking card to a chat (for quick booking confirmations)
 * @param {string} chatId - Chat ID
 * @param {object} bookingData - Booking details
 * @returns {Promise<string>} - Message ID
 */
export const sendBookingCard = async (chatId, bookingData) => {
  try {
    const messageData = {
      type: "booking_card",
      senderId: bookingData.senderId,
      senderType: bookingData.senderType,
      senderName: bookingData.senderName,
      bookingCard: {
        bookingId: bookingData.bookingId,
        turfId: bookingData.turfId,
        turfName: bookingData.turfName,
        groundId: bookingData.groundId,
        groundName: bookingData.groundName,
        sport: bookingData.sport,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        totalAmount: bookingData.totalAmount,
        status: bookingData.status || "pending", // pending | confirmed | rejected
      },
      timestamp: serverTimestamp(),
      read: false,
    };

    if (hasNativeFirestore) {
      const messageRef = await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .add(messageData);

      // Update chat with last message
      const statusText = bookingData.status === "confirmed"
        ? `Booking confirmed for ${bookingData.turfName}`
        : `Booking request for ${bookingData.turfName}`;

      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          lastMessage: {
            text: statusText,
            senderId: bookingData.senderId,
            senderType: bookingData.senderType,
            timestamp: serverTimestamp(),
            type: "booking_card",
          },
          "unreadCount.company": bookingData.senderType === "user" ? incrementValue(1) : undefined,
          updatedAt: serverTimestamp(),
        });

      return messageRef.id;
    }

    // Web SDK
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messageRef = await addDoc(messagesRef, messageData);

    const statusText = bookingData.status === "confirmed"
      ? `Booking confirmed for ${bookingData.turfName}`
      : `Booking request for ${bookingData.turfName}`;

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      lastMessage: {
        text: statusText,
        senderId: bookingData.senderId,
        senderType: bookingData.senderType,
        timestamp: serverTimestamp(),
        type: "booking_card",
      },
      ...(bookingData.senderType === "user" && { "unreadCount.company": increment(1) }),
      updatedAt: serverTimestamp(),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending booking card:", error);
    throw error;
  }
};

/**
 * Update booking card status (for manager to confirm/reject)
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} status - New status (confirmed | rejected)
 * @param {object} updateData - Additional update data
 * @returns {Promise<void>}
 */
export const updateBookingCardStatus = async (chatId, messageId, status, updateData = {}) => {
  try {
    const updates = {
      "bookingCard.status": status,
      "bookingCard.respondedAt": serverTimestamp(),
      ...Object.keys(updateData).reduce((acc, key) => {
        acc[`bookingCard.${key}`] = updateData[key];
        return acc;
      }, {}),
    };

    if (hasNativeFirestore) {
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .doc(messageId)
        .update(updates);

      const statusText = status === "confirmed"
        ? "Booking confirmed!"
        : "Booking request declined";

      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          "lastMessage.text": statusText,
          updatedAt: serverTimestamp(),
        });

      return;
    }

    // Web SDK
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    await updateDoc(messageRef, updates);

    const statusText = status === "confirmed"
      ? "Booking confirmed!"
      : "Booking request declined";

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      "lastMessage.text": statusText,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating booking card status:", error);
    throw error;
  }
};

/**
 * Upload a chat image to Firebase Storage and return the download URL
 * @param {string} chatId - Chat ID
 * @param {string} imageUri - Local image URI
 * @returns {Promise<string>} - Download URL
 */
export const uploadChatImage = async (chatId, imageUri) => {
  const fileName = `chat_${Date.now()}.jpg`;
  const storagePath = `chats/${chatId}/images/${fileName}`;

  if (hasNativeFirestore) {
    let nativeStorage = null;
    try {
      nativeStorage = require("@react-native-firebase/storage").default;
    } catch (e) {
      // fall through to web SDK
    }

    if (nativeStorage) {
      const reference = nativeStorage().ref(storagePath);
      await reference.putFile(imageUri);
      const downloadURL = await reference.getDownloadURL();
      return downloadURL;
    }
  }

  // Web SDK fallback
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const { storage } = await import("./config");
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};

/**
 * Send an image message to a chat
 * @param {string} chatId - Chat ID
 * @param {object} messageInfo - { imageUrl, senderId, senderType, senderName }
 * @returns {Promise<string>} - Message ID
 */
export const sendImageMessage = async (chatId, messageInfo) => {
  try {
    const messageData = {
      type: "image",
      imageUrl: messageInfo.imageUrl,
      text: "",
      senderId: messageInfo.senderId,
      senderType: messageInfo.senderType,
      senderName: messageInfo.senderName,
      timestamp: serverTimestamp(),
      read: false,
    };

    if (hasNativeFirestore) {
      const messageRef = await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .add(messageData);

      const unreadField = messageInfo.senderType === "user" ? "unreadCount.company" : `unreadCount.${messageInfo.senderId}`;
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          lastMessage: {
            text: "📷 Photo",
            senderId: messageInfo.senderId,
            senderType: messageInfo.senderType,
            timestamp: serverTimestamp(),
            type: "image",
          },
          [unreadField]: incrementValue(1),
          updatedAt: serverTimestamp(),
        });

      return messageRef.id;
    }

    // Web SDK
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messageRef = await addDoc(messagesRef, messageData);

    const chatRef = doc(db, "chats", chatId);
    const unreadField = messageInfo.senderType === "user" ? "unreadCount.company" : `unreadCount.${messageInfo.senderId}`;
    await updateDoc(chatRef, {
      lastMessage: {
        text: "📷 Photo",
        senderId: messageInfo.senderId,
        senderType: messageInfo.senderType,
        timestamp: serverTimestamp(),
        type: "image",
      },
      [unreadField]: increment(1),
      updatedAt: serverTimestamp(),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending image message:", error);
    throw error;
  }
};

/**
 * Send a location message to a chat
 * @param {string} chatId - Chat ID
 * @param {object} locationData - Location details
 * @returns {Promise<string>} - Message ID
 */
export const sendLocationMessage = async (chatId, locationData) => {
  try {
    const messageData = {
      type: "location",
      senderId: locationData.senderId,
      senderType: locationData.senderType,
      senderName: locationData.senderName,
      location: {
        turfId: locationData.turfId,
        turfName: locationData.turfName,
        address: locationData.address,
        city: locationData.city,
        googleMapsLink: locationData.googleMapsLink,
        coordinates: locationData.coordinates || null,
      },
      timestamp: serverTimestamp(),
      read: false,
    };

    if (hasNativeFirestore) {
      const messageRef = await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .add(messageData);

      // Update chat with last message
      const unreadField = locationData.senderType === "user" ? "unreadCount.company" : `unreadCount.${locationData.recipientId}`;
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          lastMessage: {
            text: `📍 ${locationData.turfName} location`,
            senderId: locationData.senderId,
            senderType: locationData.senderType,
            timestamp: serverTimestamp(),
            type: "location",
          },
          [unreadField]: incrementValue(1),
          updatedAt: serverTimestamp(),
        });

      return messageRef.id;
    }

    // Web SDK
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messageRef = await addDoc(messagesRef, messageData);

    const chatRef = doc(db, "chats", chatId);
    const unreadField = locationData.senderType === "user" ? "unreadCount.company" : `unreadCount.${locationData.recipientId}`;
    await updateDoc(chatRef, {
      lastMessage: {
        text: `📍 ${locationData.turfName} location`,
        senderId: locationData.senderId,
        senderType: locationData.senderType,
        timestamp: serverTimestamp(),
        type: "location",
      },
      [unreadField]: increment(1),
      updatedAt: serverTimestamp(),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending location message:", error);
    throw error;
  }
};

/**
 * Send a payment request card from manager to user in chat
 * @param {string} chatId - Chat ID
 * @param {object} data - Payment request details
 * @returns {Promise<string>} - Message ID
 */
export const sendPaymentRequestCard = async (chatId, data) => {
  try {
    const messageData = {
      type: "payment_request_card",
      senderId: data.senderId,
      senderType: "manager",
      senderName: data.senderName,
      paymentRequestCard: {
        bookingId: data.bookingId,
        turfId: data.turfId,
        turfName: data.turfName,
        groundId: data.groundId || null,
        groundName: data.groundName || null,
        sport: data.sport || null,
        date: data.date || null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        totalAmount: data.totalAmount,
        advanceAmount: data.advanceAmount,
        paymentDeadline: data.paymentDeadline,
        upiId: data.upiId || null,
        upiHolderName: data.upiHolderName || null,
        qrCodeUrl: data.qrCodeUrl || null,
        companyId: data.companyId || null,
        status: "pending", // pending | paid | approved_without_payment | expired
      },
      timestamp: serverTimestamp(),
      read: false,
    };

    if (hasNativeFirestore) {
      const messageRef = await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .add(messageData);

      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          lastMessage: {
            text: `Payment request: ₹${data.advanceAmount} for ${data.turfName}`,
            senderId: data.senderId,
            senderType: "manager",
            timestamp: serverTimestamp(),
            type: "payment_request_card",
          },
          "unreadCount.user": incrementValue(1),
          updatedAt: serverTimestamp(),
        });

      return messageRef.id;
    }

    // Web SDK
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messageRef = await addDoc(messagesRef, messageData);

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      lastMessage: {
        text: `Payment request: ₹${data.advanceAmount} for ${data.turfName}`,
        senderId: data.senderId,
        senderType: "manager",
        timestamp: serverTimestamp(),
        type: "payment_request_card",
      },
      "unreadCount.user": increment(1),
      updatedAt: serverTimestamp(),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending payment request card:", error);
    throw error;
  }
};

/**
 * Update payment request card status
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} status - New status (paid | approved_without_payment | expired)
 * @param {object} updateData - Additional update fields
 */
export const updatePaymentRequestCardStatus = async (chatId, messageId, status, updateData = {}) => {
  try {
    const updates = {
      "paymentRequestCard.status": status,
      "paymentRequestCard.respondedAt": serverTimestamp(),
      ...Object.keys(updateData).reduce((acc, key) => {
        acc[`paymentRequestCard.${key}`] = updateData[key];
        return acc;
      }, {}),
    };

    const statusText =
      status === "paid" ? "Payment submitted by user" :
      status === "approved_without_payment" ? "Booking approved without advance payment" :
      status === "expired" ? "Payment request expired" :
      "Payment request updated";

    if (hasNativeFirestore) {
      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .doc(messageId)
        .update(updates);

      await nativeFirestore()
        .collection("chats")
        .doc(chatId)
        .update({
          "lastMessage.text": statusText,
          updatedAt: serverTimestamp(),
        });

      return;
    }

    // Web SDK
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    await updateDoc(messageRef, updates);

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      "lastMessage.text": statusText,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating payment request card status:", error);
    throw error;
  }
};
