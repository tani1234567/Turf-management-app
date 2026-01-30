import { useState, useEffect, useCallback, useRef } from "react";
import {
  getOrCreateChat,
  sendMessage as sendMessageApi,
  sendNegotiationCard as sendNegotiationCardApi,
  markAsRead as markAsReadApi,
  listenToMessages,
  listenToUserChats,
  listenToCompanyChats,
  getChat,
} from "../services/firebase/chat";

/**
 * Hook for managing a single chat conversation
 * @param {string} chatId - Chat ID (optional, can be set later)
 * @param {string} viewerId - Current user/viewer ID
 * @param {string} viewerType - "user" | "manager"
 * @returns {object} - Chat state and actions
 */
export const useChat = (chatId, viewerId, viewerType) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatData, setChatData] = useState(null);
  const unsubscribeRef = useRef(null);

  // Subscribe to messages when chatId changes
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    // Fetch chat data
    getChat(chatId)
      .then((chat) => {
        setChatData(chat);
      })
      .catch((err) => {
        console.error("Error fetching chat:", err);
      });

    // Subscribe to messages
    unsubscribeRef.current = listenToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setIsLoading(false);
    });

    // Mark as read when entering chat
    if (viewerId && viewerType) {
      markAsReadApi(chatId, viewerId, viewerType).catch((err) => {
        console.error("Error marking as read:", err);
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [chatId, viewerId, viewerType]);

  /**
   * Send a text message
   */
  const sendTextMessage = useCallback(
    async (text, senderName) => {
      if (!chatId || !viewerId || !text.trim()) return null;

      try {
        const messageId = await sendMessageApi(chatId, {
          text: text.trim(),
          senderId: viewerId,
          senderType: viewerType,
          senderName,
        });
        return messageId;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [chatId, viewerId, viewerType]
  );

  /**
   * Send a negotiation card
   */
  const sendNegotiation = useCallback(
    async (negotiationData) => {
      if (!chatId || !viewerId) return null;

      try {
        const messageId = await sendNegotiationCardApi(chatId, {
          ...negotiationData,
          senderId: viewerId,
          senderType: viewerType,
        });
        return messageId;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [chatId, viewerId, viewerType]
  );

  /**
   * Mark messages as read
   */
  const markAsRead = useCallback(async () => {
    if (!chatId || !viewerId || !viewerType) return;

    try {
      await markAsReadApi(chatId, viewerId, viewerType);
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  }, [chatId, viewerId, viewerType]);

  return {
    messages,
    isLoading,
    error,
    chatData,
    sendTextMessage,
    sendNegotiation,
    markAsRead,
  };
};

/**
 * Hook for managing chat list (user side)
 * @param {string} userId - User ID
 * @returns {object} - Chats list and state
 */
export const useUserChats = (userId) => {
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      setChats([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    unsubscribeRef.current = listenToUserChats(userId, (chatsList) => {
      setChats(chatsList);

      // Calculate total unread
      const unread = chatsList.reduce((sum, chat) => {
        return sum + (chat.unreadCount?.[userId] || 0);
      }, 0);
      setTotalUnread(unread);

      setIsLoading(false);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId]);

  /**
   * Start or get a chat with a company
   */
  const startChat = useCallback(
    async (companyId, userData, companyData) => {
      if (!userId || !companyId) return null;

      try {
        const chat = await getOrCreateChat(userId, companyId, userData, companyData);
        return chat;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [userId]
  );

  return {
    chats,
    isLoading,
    error,
    totalUnread,
    startChat,
  };
};

/**
 * Hook for managing chat list (company/manager side)
 * @param {string} companyId - Company ID
 * @returns {object} - Chats list and state
 */
export const useCompanyChats = (companyId) => {
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!companyId) {
      setChats([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    unsubscribeRef.current = listenToCompanyChats(companyId, (chatsList) => {
      setChats(chatsList);

      // Calculate total unread for company
      const unread = chatsList.reduce((sum, chat) => {
        return sum + (chat.unreadCount?.company || 0);
      }, 0);
      setTotalUnread(unread);

      setIsLoading(false);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [companyId]);

  return {
    chats,
    isLoading,
    error,
    totalUnread,
  };
};

export default useChat;
