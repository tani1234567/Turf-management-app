import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  IconButton,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { addReview } from "../../services/firebase/reviews";

const USER_COLOR = "#10B981";

export default function WriteReviewScreen({ navigation, route }) {
  const {
    bookingId,
    turfId,
    turfName,
    companyId,
  } = route.params || {};

  const user = useSelector(selectUser);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a star rating.");
      return;
    }

    if (!comment.trim()) {
      Alert.alert("Comment Required", "Please write a short comment about your experience.");
      return;
    }

    setSubmitting(true);

    try {
      await addReview(
        {
          bookingId: bookingId || null,
          turfId,
          turfName: turfName || "Turf",
          companyId: companyId || user?.companyId || null,
          rating,
          comment: comment.trim(),
        },
        user
      );

      Alert.alert(
        "Thank You!",
        "Your review has been submitted successfully.",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error("Error submitting review:", error);
      Alert.alert("Error", "Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarSelector = () => {
    const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

    return (
      <View style={styles.starSection}>
        <Text variant="titleMedium" style={styles.starTitle}>
          How was your experience?
        </Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              activeOpacity={0.7}
              style={styles.starTouchable}
            >
              <MaterialCommunityIcons
                name={star <= rating ? "star" : "star-outline"}
                size={44}
                color={star <= rating ? "#FFC107" : "#DDD"}
              />
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && (
          <Text variant="bodyMedium" style={styles.ratingLabel}>
            {labels[rating]}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Write Review
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Turf info */}
          <Surface style={styles.turfCard} elevation={1}>
            <View style={styles.turfRow}>
              <View style={styles.turfIconContainer}>
                <MaterialCommunityIcons
                  name="soccer-field"
                  size={28}
                  color={USER_COLOR}
                />
              </View>
              <View style={styles.turfInfo}>
                <Text variant="titleMedium" style={styles.turfName}>
                  {turfName || "Turf"}
                </Text>
                <Text variant="bodySmall" style={styles.turfSubtext}>
                  Share your experience with others
                </Text>
              </View>
            </View>
          </Surface>

          {/* Star Rating */}
          <Surface style={styles.ratingCard} elevation={1}>
            {renderStarSelector()}
          </Surface>

          {/* Comment */}
          <Surface style={styles.commentCard} elevation={1}>
            <Text variant="titleSmall" style={styles.commentLabel}>
              Your Review
            </Text>
            <TextInput
              mode="outlined"
              label="Write your experience..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              style={styles.commentInput}
              outlineColor="#E0E0E0"
              activeOutlineColor={USER_COLOR}
              maxLength={500}
            />
            <Text variant="bodySmall" style={styles.charCount}>
              {comment.length}/500
            </Text>
          </Surface>

          {/* Tips */}
          <Surface style={styles.tipsCard} elevation={1}>
            <Text variant="titleSmall" style={styles.tipsTitle}>
              Tips for a helpful review
            </Text>
            {[
              "Mention the ground condition and facilities",
              "Share about the booking experience",
              "Comment on staff behavior and support",
              "Would you recommend this turf?",
            ].map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={16}
                  color={USER_COLOR}
                />
                <Text variant="bodySmall" style={styles.tipText}>
                  {tip}
                </Text>
              </View>
            ))}
          </Surface>

          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || rating === 0}
            style={styles.submitButton}
            buttonColor={USER_COLOR}
            contentStyle={styles.submitContent}
            icon="send"
          >
            Submit Review
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Turf Card
  turfCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  turfRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  turfIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  turfInfo: {
    marginLeft: 14,
    flex: 1,
  },
  turfName: {
    fontWeight: "bold",
    color: "#333",
  },
  turfSubtext: {
    color: "#999",
    marginTop: 2,
  },

  // Rating Card
  ratingCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
    alignItems: "center",
  },
  starSection: {
    alignItems: "center",
  },
  starTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
  },
  starTouchable: {
    padding: 4,
  },
  ratingLabel: {
    marginTop: 10,
    color: "#FFC107",
    fontWeight: "600",
  },

  // Comment Card
  commentCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  commentLabel: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  commentInput: {
    backgroundColor: "#fff",
    maxHeight: 150,
  },
  charCount: {
    textAlign: "right",
    color: "#999",
    marginTop: 4,
  },

  // Tips Card
  tipsCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 24,
  },
  tipsTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    color: "#666",
    flex: 1,
  },

  // Submit Button
  submitButton: {
    borderRadius: 12,
  },
  submitContent: {
    paddingVertical: 6,
  },
});
