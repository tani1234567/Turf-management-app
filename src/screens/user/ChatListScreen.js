import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Text, Surface, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../../hooks/useAuth";
import { useUserChats } from "../../hooks/useChat";
import { ChatListItem } from "../../components/chat";
import { COLORS } from "../../constants/theme";

export default function ChatListScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { chats, isLoading, totalUnread } = useUserChats(user?.userId);

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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={styles.emptyCard} elevation={1}>
        <MaterialCommunityIcons name="chat-outline" size={64} color="#ccc" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No Messages Yet
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          When you book a turf, you'll be able to chat with the manager here
        </Text>
        <Text variant="bodySmall" style={styles.emptyHint}>
          You can also start a chat from the turf details page
        </Text>
      </Surface>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text variant="headlineSmall" style={styles.title}>
          Messages
        </Text>
        {totalUnread > 0 && (
          <View style={styles.totalUnreadBadge}>
            <Text style={styles.totalUnreadText}>
              {totalUnread > 99 ? "99+" : totalUnread} unread
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading && chats.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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

      {chats.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
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
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  totalUnreadBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalUnreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
  emptyHint: {
    marginTop: 16,
    color: COLORS.primary,
    textAlign: "center",
  },
});
