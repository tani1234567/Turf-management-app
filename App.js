// Import Firebase compat SDK first (required for expo-firebase-recaptcha on web)
import "./src/services/firebase/firebase-compat";

import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { Provider as ReduxProvider } from "react-redux";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import RootNavigator from "./src/navigation/RootNavigator";
import { store } from "./src/store";
import {
  registerNotificationListeners,
  setNavigationRef,
  handleInitialNotification,
} from "./src/services/notifications/handlers";
import { paperTheme } from "./src/constants/paperTheme";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  const navigationRef = useRef(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Load custom fonts
  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          "Ubuntu-Regular": require("./assets/fonts/Ubuntu-Regular.ttf"),
          "Ubuntu-Medium": require("./assets/fonts/Ubuntu-Medium.ttf"),
          "Ubuntu-Bold": require("./assets/fonts/Ubuntu-Bold.ttf"),
        });
        setFontsLoaded(true);
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error("Error loading fonts:", error);
      }
    }
    loadFonts();
  }, []);

  // Register notification listeners on mount
  useEffect(() => {
    if (Platform.OS === "web") return;

    const cleanup = registerNotificationListeners();
    return cleanup;
  }, []);

  // Show nothing until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <PaperProvider theme={paperTheme}>
          <SafeAreaProvider>
            <NavigationContainer
              ref={navigationRef}
              onReady={() => {
                setNavigationRef(navigationRef.current);
                handleInitialNotification();
              }}
            >
              <RootNavigator />
              <StatusBar style="auto" />
            </NavigationContainer>
          </SafeAreaProvider>
        </PaperProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
