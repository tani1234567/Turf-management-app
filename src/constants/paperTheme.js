import { MD3LightTheme } from 'react-native-paper';
import { COLORS, FONTS } from './theme';

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    error: COLORS.error,
  },
  fonts: {
    // Headers - Ubuntu Bold
    displayLarge: { fontFamily: FONTS.bold, fontSize: 57, fontWeight: '700', letterSpacing: 0, lineHeight: 64 },
    displayMedium: { fontFamily: FONTS.bold, fontSize: 45, fontWeight: '700', letterSpacing: 0, lineHeight: 52 },
    displaySmall: { fontFamily: FONTS.bold, fontSize: 36, fontWeight: '700', letterSpacing: 0, lineHeight: 44 },
    headlineLarge: { fontFamily: FONTS.bold, fontSize: 32, fontWeight: '700', letterSpacing: 0, lineHeight: 40 },
    headlineMedium: { fontFamily: FONTS.bold, fontSize: 28, fontWeight: '700', letterSpacing: 0, lineHeight: 36 },
    headlineSmall: { fontFamily: FONTS.bold, fontSize: 24, fontWeight: '700', letterSpacing: 0, lineHeight: 32 },

    // Titles - Ubuntu Bold/Medium
    titleLarge: { fontFamily: FONTS.bold, fontSize: 22, fontWeight: '700', letterSpacing: 0, lineHeight: 28 },
    titleMedium: { fontFamily: FONTS.medium, fontSize: 16, fontWeight: '500', letterSpacing: 0.15, lineHeight: 24 },
    titleSmall: { fontFamily: FONTS.medium, fontSize: 14, fontWeight: '500', letterSpacing: 0.1, lineHeight: 20 },

    // Labels - Ubuntu Medium (for buttons, tabs, labels)
    labelLarge: { fontFamily: FONTS.medium, fontSize: 14, fontWeight: '500', letterSpacing: 0.1, lineHeight: 20 },
    labelMedium: { fontFamily: FONTS.medium, fontSize: 12, fontWeight: '500', letterSpacing: 0.5, lineHeight: 16 },
    labelSmall: { fontFamily: FONTS.medium, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, lineHeight: 16 },

    // Body text - Ubuntu Regular
    bodyLarge: { fontFamily: FONTS.regular, fontSize: 16, fontWeight: '400', letterSpacing: 0.15, lineHeight: 24 },
    bodyMedium: { fontFamily: FONTS.regular, fontSize: 14, fontWeight: '400', letterSpacing: 0.25, lineHeight: 20 },
    bodySmall: { fontFamily: FONTS.regular, fontSize: 12, fontWeight: '400', letterSpacing: 0.4, lineHeight: 16 },
  },
};
