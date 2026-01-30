import React, { memo, useState, useCallback } from "react";
import { View, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { TextInput, IconButton, Button } from "react-native-paper";
import { COLORS } from "../../constants/theme";

/**
 * ChatInput component for typing and sending messages
 * @param {object} props
 * @param {function} props.onSend - Send message handler
 * @param {function} props.onRequestBooking - Request booking handler (user only)
 * @param {boolean} props.showRequestBooking - Whether to show request booking button
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.placeholder - Input placeholder text
 * @param {string} props.accentColor - Accent color for buttons
 */
const ChatInput = ({
  onSend,
  onRequestBooking,
  showRequestBooking = false,
  isLoading = false,
  placeholder = "Type a message...",
  accentColor = COLORS.primary,
}) => {
  const [message, setMessage] = useState("");

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Request Booking Button (for users) */}
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
          {/* Attachment Button */}
          <IconButton
            icon="plus-circle-outline"
            size={26}
            iconColor={COLORS.textSecondary}
            onPress={() => {
              // TODO: Implement attachment options
            }}
            style={styles.attachButton}
          />

          {/* Text Input */}
          <TextInput
            mode="outlined"
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            multiline
            maxLength={1000}
            dense
            right={
              message.trim() ? (
                <TextInput.Icon
                  icon="send"
                  color={accentColor}
                  onPress={handleSend}
                  disabled={isLoading}
                />
              ) : null
            }
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />

          {/* Send Button (alternative, visible when no text) */}
          {!message.trim() && (
            <IconButton
              icon="microphone"
              size={26}
              iconColor={COLORS.textSecondary}
              onPress={() => {
                // TODO: Implement voice message
              }}
              style={styles.micButton}
            />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
  },
  requestBookingContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
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
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  attachButton: {
    margin: 0,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: "#f5f5f5",
  },
  inputOutline: {
    borderRadius: 20,
    borderColor: "#e0e0e0",
  },
  inputContent: {
    paddingVertical: 8,
  },
  micButton: {
    margin: 0,
    marginBottom: 4,
  },
});

export default memo(ChatInput);
