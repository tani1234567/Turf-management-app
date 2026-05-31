import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MaintenanceScreen({ onRetry, isChecking }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔧</Text>
        <Text style={styles.title}>Under Maintenance</Text>
        <Text style={styles.subtitle}>
          We're making improvements to give you a better experience. Please
          check back shortly.
        </Text>

        {isChecking ? (
          <ActivityIndicator
            size="small"
            color="#4CAF50"
            style={styles.spinner}
          />
        ) : (
          <TouchableOpacity style={styles.button} onPress={onRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 26,
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  buttonText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 16,
    color: "#fff",
  },
  spinner: {
    marginTop: 8,
  },
});
