import React, { memo, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  StatusBar,
  Platform,
} from "react-native";
import { Text, ActivityIndicator, IconButton } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

/**
 * Format timestamp to time string
 */
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Fullscreen image viewer modal
 */
const ImageViewerModal = ({ visible, imageUrl, onClose }) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={imageViewerStyles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Close button */}
        <View style={[imageViewerStyles.topBar, { paddingTop: insets.top }]}>
          <IconButton
            icon="close"
            size={26}
            iconColor="#fff"
            onPress={onClose}
          />
        </View>

        {/* Full-size image */}
        <View style={imageViewerStyles.imageWrapper}>
          <Image
            source={{ uri: imageUrl }}
            style={imageViewerStyles.fullImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </Modal>
  );
};

const imageViewerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 4,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});

/**
 * ChatBubble component for displaying text and image messages
 */
const ChatBubble = ({ message, isOwn, showSenderName = false, accentColor = COLORS.primary }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const isImage = message.type === "image" && message.imageUrl;

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      {showSenderName && !isOwn && (
        <Text variant="labelSmall" style={styles.senderName}>
          {message.senderName}
        </Text>
      )}
      <View
        style={[
          styles.bubble,
          isOwn ? [styles.ownBubble, { backgroundColor: accentColor }] : styles.otherBubble,
          isImage && styles.imageBubble,
        ]}
      >
        {isImage ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowImageViewer(true)}
              style={styles.imageContainer}
            >
              {imageLoading && (
                <View style={styles.imageLoader}>
                  <ActivityIndicator size="small" color={isOwn ? "#fff" : accentColor} />
                </View>
              )}
              <Image
                source={{ uri: message.imageUrl }}
                style={styles.chatImage}
                resizeMode="cover"
                onLoadEnd={() => setImageLoading(false)}
              />
            </TouchableOpacity>

            <ImageViewerModal
              visible={showImageViewer}
              imageUrl={message.imageUrl}
              onClose={() => setShowImageViewer(false)}
            />
          </>
        ) : (
          <Text
            variant="bodyMedium"
            style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}
          >
            {message.text}
          </Text>
        )}
        <Text
          variant="labelSmall"
          style={[styles.timestamp, isOwn ? styles.ownTimestamp : styles.otherTimestamp]}
        >
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    maxWidth: "85%",
  },
  ownContainer: {
    alignSelf: "flex-end",
  },
  otherContainer: {
    alignSelf: "flex-start",
  },
  senderName: {
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginLeft: 8,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    lineHeight: 20,
  },
  ownText: {
    color: "#fff",
  },
  otherText: {
    color: COLORS.text,
  },
  timestamp: {
    marginTop: 4,
    alignSelf: "flex-end",
  },
  ownTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherTimestamp: {
    color: COLORS.textSecondary,
  },
  imageBubble: {
    padding: 4,
    paddingBottom: 6,
    overflow: "hidden",
  },
  imageContainer: {
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  chatImage: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55 * 0.75,
    borderRadius: 14,
  },
  imageLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
});

export default memo(ChatBubble);
