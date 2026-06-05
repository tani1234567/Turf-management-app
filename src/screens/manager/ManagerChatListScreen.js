import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../../hooks/useAuth";
import { useAppSelector } from "../../hooks/useAppSelector";
import { useCompanyChats } from "../../hooks/useChat";
import { ChatListItem } from "../../components/chat";
import { selectCompany } from "../../store/slices/companySlice";

const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const NAVY_BLUE = "#1E40AF";

export default function ManagerChatListScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const company = useAppSelector(selectCompany);
  const { chats, isLoading, totalUnread } = useCompanyChats(company?.companyId || company?.id);

  const [filter, setFilter] = useState("all");

  // Filter chats based on selected filter
  const filteredChats = useMemo(() => {
    if (filter === "all") return chats;
    if (filter === "negotiation") {
      return chats.filter((chat) => chat.hasActiveNegotiation);
    }
    if (filter === "unread") {
      return chats.filter((chat) => (chat.unreadCount?.company || 0) > 0);
    }
    return chats;
  }, [chats, filter]);

  // Count for each filter
  const filterCounts = useMemo(() => {
    const negotiationCount = chats.filter((chat) => chat.hasActiveNegotiation).length;
    const unreadCount = chats.filter((chat) => (chat.unreadCount?.company || 0) > 0).length;
    return {
      all: chats.length,
      negotiation: negotiationCount,
      unread: unreadCount,
    };
  }, [chats]);

  const handleChatPress = useCallback(
    (chat) => {
      navigation.navigate("ManagerChatScreen", {
        chatId: chat.id,
        userName: chat.participants?.user?.name || "Customer",
        userId: chat.participants?.user?.userId,
      });
    },
    [navigation]
  );

  const viewerType = user?.role === "owner" ? "owner" : "manager";

  const renderChatItem = useCallback(
    ({ item }) => (
      <ChatListItem
        chat={item}
        viewerType={viewerType}
        viewerId={user?.userId}
        onPress={() => handleChatPress(item)}
      />
    ),
    [user?.userId, viewerType, handleChatPress]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const FILTER_OPTIONS = [
    { value: "all", label: "All", icon: "chat-outline" },
    { value: "negotiation", label: "Requests", icon: "handshake-outline" },
    { value: "unread", label: "Unread", icon: "message-badge-outline" },
  ];

  const renderEmptyState = () => {
    const isFiltered = filter !== "all";
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons
              name={isFiltered ? "filter-outline" : "chat-outline"}
              size={40}
              color={MANAGER_BLUE}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {isFiltered ? "No Matching Chats" : "No Messages Yet"}
          </Text>
          <Text style={styles.emptyText}>
            {isFiltered
              ? "Try changing your filter to see more conversations"
              : "Customer inquiries and booking messages will appear here"}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Customer conversations</Text>
        </View>
        {totalUnread > 0 && (
          <View style={styles.totalUnreadBadge}>
            <Text style={styles.totalUnreadText}>
              {totalUnread > 99 ? "99+" : totalUnread} unread
            </Text>
          </View>
        )}
      </View>

      {/* Filter tabs */}
      {chats.length > 0 && (
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((opt) => {
            const count = filterCounts[opt.value];
            const isActive = filter === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setFilter(opt.value)}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={14}
                  color={isActive ? "#fff" : "#6B7280"}
                />
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {opt.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  if (isLoading && chats.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
          <Text style={styles.loadingText}>
            Loading conversations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {renderHeader()}

      {filteredChats.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              colors={[MANAGER_BLUE]}
              tintColor={MANAGER_BLUE}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginTop: 1,
  },
  totalUnreadBadge: {
    backgroundColor: MANAGER_BLUE,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  totalUnreadText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Ubuntu-Bold",
  },

  // Filter tabs (custom)
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
    color: "#6B7280",
  },
  filterTabTextActive: {
    color: "#fff",
    fontFamily: "Ubuntu-Bold",
  },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  filterBadgeText: {
    fontSize: 9,
    fontFamily: "Ubuntu-Bold",
    color: "#6B7280",
  },
  filterBadgeTextActive: {
    color: "#fff",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
  },

  // List
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 0,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 36,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALE_BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
});
