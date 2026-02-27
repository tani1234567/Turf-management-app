import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Surface, Button, TextInput, IconButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Reusable ReviewCard component
 *
 * @param {Object} review - Review object with rating, comment, userName, etc.
 * @param {string} accentColor - Theme color (#4CAF50 for user, #2196F3 for manager, #9C27B0 for owner)
 * @param {boolean} showActions - Show respond/flag actions (manager/owner view)
 * @param {boolean} showTurfName - Show turf name (for multi-turf views)
 * @param {Function} onRespond - Callback(reviewId, responseText) for responding
 * @param {Function} onFlag - Callback(reviewId) for flagging
 * @param {Function} onRemove - Callback(reviewId) for removing (owner only)
 * @param {Function} onRestore - Callback(reviewId) for restoring flagged review
 */
export default function ReviewCard({
  review,
  accentColor = "#4CAF50",
  showActions = false,
  showTurfName = false,
  onRespond,
  onFlag,
  onRemove,
  onRestore,
}) {
  const [respondVisible, setRespondVisible] = useState(false);
  const [responseText, setResponseText] = useState(review.response || "");
  const [submitting, setSubmitting] = useState(false);

  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    let date;
    if (dateValue.toDate) {
      date = dateValue.toDate();
    } else if (dateValue.seconds) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue);
    }
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) return;
    setSubmitting(true);
    try {
      if (onRespond) {
        await onRespond(review.id, responseText.trim());
      }
      setRespondVisible(false);
    } catch (error) {
      console.error("Error submitting response:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating, size = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <MaterialCommunityIcons
          key={i}
          name={i <= rating ? "star" : i - 0.5 <= rating ? "star-half-full" : "star-outline"}
          size={size}
          color="#FFC107"
        />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const isFlagged = review.status === "flagged";
  const isRemoved = review.status === "removed";

  return (
    <Surface
      style={[
        styles.card,
        isFlagged && styles.cardFlagged,
        isRemoved && styles.cardRemoved,
      ]}
      elevation={1}
    >
      {/* Status badge for flagged/removed */}
      {(isFlagged || isRemoved) && (
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isFlagged ? "#FFF3E0" : "#FFEBEE" },
          ]}
        >
          <MaterialCommunityIcons
            name={isFlagged ? "flag" : "close-circle"}
            size={14}
            color={isFlagged ? "#FF9800" : "#F44336"}
          />
          <Text
            variant="labelSmall"
            style={{
              color: isFlagged ? "#FF9800" : "#F44336",
              marginLeft: 4,
              fontWeight: "600",
            }}
          >
            {isFlagged ? "Flagged" : "Removed"}
            {isFlagged && review.flagReason ? ` - ${review.flagReason}` : ""}
          </Text>
        </View>
      )}

      {/* Review header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: `${accentColor}20` }]}>
            <Text style={[styles.avatarText, { color: accentColor }]}>
              {(review.userName || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userMeta}>
            <Text variant="titleSmall" style={styles.userName}>
              {review.userName || "Anonymous"}
            </Text>
            <Text variant="bodySmall" style={styles.date}>
              {formatDate(review.createdAt)}
            </Text>
          </View>
        </View>
        {renderStars(review.rating)}
      </View>

      {/* Turf name if showing */}
      {showTurfName && review.turfName && (
        <View style={styles.turfRow}>
          <MaterialCommunityIcons name="soccer-field" size={14} color="#999" />
          <Text variant="bodySmall" style={styles.turfName}>
            {review.turfName}
          </Text>
        </View>
      )}

      {/* Review comment */}
      {review.comment ? (
        <Text variant="bodyMedium" style={styles.comment}>
          {review.comment}
        </Text>
      ) : null}

      {/* Manager/Owner Response */}
      {review.response && (
        <View style={styles.responseContainer}>
          <View style={styles.responseHeader}>
            <MaterialCommunityIcons name="reply" size={16} color={accentColor} />
            <Text variant="labelMedium" style={[styles.responseLabel, { color: accentColor }]}>
              Response from {review.respondedByName || "Management"}
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.responseText}>
            {review.response}
          </Text>
          {review.respondedAt && (
            <Text variant="labelSmall" style={styles.responseDate}>
              {formatDate(review.respondedAt)}
            </Text>
          )}
        </View>
      )}

      {/* Actions for manager/owner */}
      {showActions && (
        <View style={styles.actionsRow}>
          {/* Respond button */}
          {!review.response && !isRemoved && (
            <Button
              mode="text"
              compact
              icon="reply"
              textColor={accentColor}
              onPress={() => setRespondVisible(!respondVisible)}
            >
              Respond
            </Button>
          )}

          {/* Flag button (only for active reviews) */}
          {!isFlagged && !isRemoved && onFlag && (
            <Button
              mode="text"
              compact
              icon="flag-outline"
              textColor="#FF9800"
              onPress={() => onFlag(review.id)}
            >
              Flag
            </Button>
          )}

          {/* Remove button (owner, for flagged reviews) */}
          {isFlagged && onRemove && (
            <Button
              mode="text"
              compact
              icon="delete-outline"
              textColor="#F44336"
              onPress={() => onRemove(review.id)}
            >
              Remove
            </Button>
          )}

          {/* Restore button (for flagged/removed reviews) */}
          {(isFlagged || isRemoved) && onRestore && (
            <Button
              mode="text"
              compact
              icon="restore"
              textColor="#4CAF50"
              onPress={() => onRestore(review.id)}
            >
              Restore
            </Button>
          )}
        </View>
      )}

      {/* Respond input */}
      {respondVisible && (
        <View style={styles.respondInput}>
          <TextInput
            mode="outlined"
            label="Your response"
            value={responseText}
            onChangeText={setResponseText}
            multiline
            numberOfLines={3}
            style={styles.responseInput}
            outlineColor="#E0E0E0"
            activeOutlineColor={accentColor}
          />
          <View style={styles.respondActions}>
            <Button
              mode="text"
              compact
              textColor="#666"
              onPress={() => {
                setRespondVisible(false);
                setResponseText(review.response || "");
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              compact
              buttonColor={accentColor}
              loading={submitting}
              disabled={submitting || !responseText.trim()}
              onPress={handleSubmitResponse}
            >
              Submit
            </Button>
          </View>
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 14,
    marginBottom: 12,
  },
  cardFlagged: {
    borderLeftWidth: 3,
    borderLeftColor: "#FF9800",
  },
  cardRemoved: {
    borderLeftWidth: 3,
    borderLeftColor: "#F44336",
    opacity: 0.7,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  userMeta: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontWeight: "600",
    color: "#333",
  },
  date: {
    color: "#999",
    marginTop: 1,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  turfRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  turfName: {
    color: "#999",
  },
  comment: {
    color: "#444",
    marginTop: 10,
    lineHeight: 20,
  },

  // Response
  responseContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  responseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  responseLabel: {
    fontWeight: "600",
  },
  responseText: {
    color: "#555",
    lineHeight: 18,
  },
  responseDate: {
    color: "#999",
    marginTop: 4,
  },

  // Actions
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 4,
  },

  // Respond input
  respondInput: {
    marginTop: 10,
  },
  responseInput: {
    backgroundColor: "#fff",
  },
  respondActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
});
