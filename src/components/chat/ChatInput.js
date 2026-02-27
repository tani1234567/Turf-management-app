import React, { memo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Alert,
  TextInput as RNTextInput,
  TouchableOpacity,
} from "react-native";
import { IconButton, Button, ActivityIndicator } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

/**
 * WhatsApp-style ChatInput component
 */
const ChatInput = ({
  onSend,
  onSendImage,
  onRequestBooking,
  showRequestBooking = false,
  isLoading = false,
  placeholder = "Message",
  accentColor = COLORS.primary,
}) => {
  const [message, setMessage] = useState("");
  const [isPickingImage, setIsPickingImage] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSend = useCallback(() => {
    if (!message.trim() || isLoading) return;
    onSend(message.trim());
    setMessage("");
  }, [message, isLoading, onSend]);

  const handleRequestBooking = useCallback(() => {
    if (onRequestBooking) {
      onRequestBooking();
    }
  }, [onRequestBooking]);

  const handlePickImage = useCallback(async () => {
    if (!onSendImage || isPickingImage) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow access to your photo library to send images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setIsPickingImage(true);
        await onSendImage(result.assets[0].uri);
        setIsPickingImage(false);
      }
    } catch (error) {
      console.error("[ChatInput] Error picking image:", error);
      setIsPickingImage(false);
      Alert.alert("Error", "Failed to send image. Please try again.");
    }
  }, [onSendImage, isPickingImage]);

  const hasText = message.trim().length > 0;
  const bottomPadding = Math.max(insets.bottom, 6);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      {/* Request Booking Button */}
      {showRequestBooking && (
        <View style={styles.requestBookingContainer}>
          <Button
            mode="outlined"
            onPress={handleRequestBooking}
            icon="calendar-plus"
            style={styles.requestBookingButton}
            labelStyle={styles.requestBookingLabel}
            contentStyle={styles.requestBookingContent}
            compact
          >
            Request Booking
          </Button>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.inputRow}>
        {/* Input field with attach button inside */}
        <View style={styles.inputContainer}>
          {/* Attachment / image button */}
          {isPickingImage ? (
            <View style={styles.inlineIcon}>
              <ActivityIndicator size={20} color={accentColor} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.inlineIcon}
              onPress={handlePickImage}
              disabled={isPickingImage}
            >
              <MaterialCommunityIcons name="paperclip" size={22} color="#9E9E9E" />
            </TouchableOpacity>
          )}

          {/* Text Input */}
          <RNTextInput
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            placeholderTextColor="#9E9E9E"
            style={styles.textInput}
            multiline
            maxLength={1000}
            textAlignVertical="center"
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: accentColor }]}
          onPress={handleSend}
          disabled={isLoading || !hasText}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="send"
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E0E0E0",
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  requestBookingContainer: {
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  requestBookingButton: {
    borderColor: COLORS.primary,
    borderStyle: "dashed",
  },
  requestBookingLabel: {
    color: COLORS.primary,
    fontSize: 13,
  },
  requestBookingContent: {
    height: 36,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 24,
    paddingHorizontal: 4,
    minHeight: 44,
    maxHeight: 120,
  },
  inlineIcon: {
    width: 36,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 12,
    paddingLeft: 2,
    maxHeight: 120,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default memo(ChatInput);
