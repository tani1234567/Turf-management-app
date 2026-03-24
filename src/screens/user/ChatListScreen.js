import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Animated,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../../hooks/useAuth";
import { useUserChats } from "../../hooks/useChat";
import { ChatListItem } from "../../components/chat";
import { COLORS, FONTS } from "../../constants/theme";

const USER_COLOR = "#10B981";
const EMERALD_PALE = "#D1FAE5";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
];

export default function ChatListScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { chats, isLoading, totalUnread } = useUserChats(user?.userId);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchVisible, setSearchVisible] = useState(false);

  const handleChatPress = useCallback(
    (chat) => {
      navigation.navigate("ChatScreen", {
        chatId: chat.id,
        companyName: chat.participants?.company?.name || "Chat",
        companyId: chat.participants?.company?.companyId,
      });
    },
    [navigation]
  );

  // Filter + search logic
  const filteredChats = useMemo(() => {
    let result = chats;

    if (activeFilter === "unread") {
      result = result.filter(
        (c) => (c.unreadCount?.[user?.userId] || 0) > 0
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) =>
        (c.participants?.company?.name || "").toLowerCase().includes(q) ||
        (c.lastMessage?.text || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [chats, activeFilter, searchQuery, user?.userId]);

  const renderChatItem = useCallback(
    ({ item }) => (
      <ChatListItem
        chat={item}
        viewerType="user"
        viewerId={user?.userId}
        onPress={() => handleChatPress(item)}
      />
    ),
    [user?.userId, handleChatPress]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    []
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading && chats.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header
          totalUnread={totalUnread}
          searchVisible={searchVisible}
          searchQuery={searchQuery}
          onSearchToggle={() => setSearchVisible((v) => !v)}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={USER_COLOR} />
          <Text style={styles.loadingText}>Loading conversations…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header
        totalUnread={totalUnread}
        searchVisible={searchVisible}
        searchQuery={searchQuery}
        onSearchToggle={() => {
          setSearchVisible((v) => {
            if (v) setSearchQuery(""); // clear on hide
            return !v;
          });
        }}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {filteredChats.length === 0 ? (
        <EmptyState filter={activeFilter} searchQuery={searchQuery} />
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              colors={[USER_COLOR]}
              tintColor={USER_COLOR}
            />
          }
          ItemSeparatorComponent={ItemSeparator}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Header({
  totalUnread,
  searchVisible,
  searchQuery,
  onSearchToggle,
  onSearchChange,
  activeFilter,
  onFilterChange,
}) {
  return (
    <View style={styles.headerWrapper}>
      {/* Top bar */}
      <View style={styles.topBar}>
        {searchVisible ? (
          <View style={styles.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={COLORS.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations…"
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange("")}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.titleRow}>
            <Text style={styles.title}>Messages</Text>
            {totalUnread > 0 && (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>
                  {totalUnread > 99 ? "99+" : totalUnread}
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onSearchToggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name={searchVisible ? "close" : "magnify"}
            size={24}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterPill,
              activeFilter === f.key && styles.filterPillActive,
            ]}
            onPress={() => onFilterChange(f.key)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterLabel,
                activeFilter === f.key && styles.filterLabelActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function EmptyState({ filter, searchQuery }) {
  const isSearch = searchQuery.trim().length > 0;
  const isUnread = filter === "unread";

  let icon = "chat-outline";
  let title = "No Messages Yet";
  let subtitle =
    "When you book a turf, you can chat with the manager here. You can also start a chat from the turf details page.";

  if (isSearch) {
    icon = "magnify-close";
    title = "No Results Found";
    subtitle = `No conversations match "${searchQuery}".`;
  } else if (isUnread) {
    icon = "check-all";
    title = "All Caught Up!";
    subtitle = "You have no unread messages.";
  }

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <MaterialCommunityIcons name={icon} size={48} color={USER_COLOR} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {!isSearch && !isUnread && (
        <View style={styles.emptyHintRow}>
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color={USER_COLOR}
          />
          <Text style={styles.emptyHint}>
            {"  "}Start from a turf's detail page
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },

  // Header
  headerWrapper: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ebebeb",
    paddingBottom: 6,
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: "#111",
    letterSpacing: -0.3,
  },
  totalBadge: {
    backgroundColor: USER_COLOR,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: "#fff",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },

  // Search
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 24,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#111",
    paddingVertical: 0,
  },

  // Filter pills
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingBottom: 4,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  filterPillActive: {
    backgroundColor: USER_COLOR,
  },
  filterLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterLabelActive: {
    color: "#fff",
  },

  // List
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  separator: {
    height: 1,
    marginLeft: 80, // indent past avatar
    backgroundColor: "#efefef",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: EMERALD_PALE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: "#222",
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyHintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  emptyHint: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: USER_COLOR,
  },
});
