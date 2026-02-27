import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Text, Surface, ActivityIndicator, SegmentedButtons } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../../hooks/useAuth";
import { useAppSelector } from "../../hooks/useAppSelector";
import { useCompanyChats } from "../../hooks/useChat";
import { ChatListItem } from "../../components/chat";
import { COLORS } from "../../constants/theme";
import { selectCompany } from "../../store/slices/companySlice";

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

  const renderEmptyState = () => {
    const isFiltered = filter !== "all";
    return (
      <View style={styles.emptyContainer}>
        <Surface style={styles.emptyCard} elevation={1}>
          <MaterialCommunityIcons
            name={isFiltered ? "filter-outline" : "chat-outline"}
            size={64}
            color="#ccc"
          />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {isFiltered ? "No Matching Chats" : "No Messages Yet"}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {isFiltered
              ? "Try changing your filter to see more conversations"
              : "Customer inquiries and booking messages will appear here"}
          </Text>
        </Surface>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text variant="headlineSmall" style={styles.title}>
          Customer Messages
        </Text>
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
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            {
              value: "all",
              label: `All (${filterCounts.all})`,
              style: styles.filterButton,
            },
            {
              value: "negotiation",
              label: `Requests (${filterCounts.negotiation})`,
              icon: "handshake-outline",
              style: styles.filterButton,
            },
            {
              value: "unread",
              label: `Unread (${filterCounts.unread})`,
              style: styles.filterButton,
            },
          ]}
          style={styles.filterTabs}
          density="small"
        />
      )}
    </View>
  );

  if (isLoading && chats.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading conversations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
              colors={[COLORS.secondary]}
              tintColor={COLORS.secondary}
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
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  totalUnreadBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalUnreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  filterTabs: {
    backgroundColor: "#f5f5f5",
  },
  filterButton: {
    minWidth: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: "600",
    color: "#333",
  },
  emptyText: {
    marginTop: 8,
    color: "#999",
    textAlign: "center",
  },
});
