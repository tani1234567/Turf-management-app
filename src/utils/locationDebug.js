/**
 * Location System Debugging Utilities
 * Use these functions in development to test and debug the location system
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { MUMBAI_AREAS, findNearestArea, getAreasWithDistances } from "../constants/mumbaiAreas";

/**
 * Log all saved areas from AsyncStorage
 */
export const debugSavedAreas = async () => {
  try {
    const saved = await AsyncStorage.getItem("selectedAreas");
    if (saved) {
      const areaIds = JSON.parse(saved);
      const areaNames = areaIds.map(id => {
        const area = MUMBAI_AREAS.find(a => a.id === id);
        return area ? area.name : `Unknown (${id})`;
      });
      console.log("📍 Saved Areas:", areaNames.join(", "));
      console.log("📍 Area IDs:", areaIds);
      return areaIds;
    } else {
      console.log("📍 No saved areas");
      return [];
    }
  } catch (error) {
    console.error("❌ Error reading saved areas:", error);
    return null;
  }
};

/**
 * Clear all saved areas
 */
export const debugClearSavedAreas = async () => {
  try {
    await AsyncStorage.removeItem("selectedAreas");
    console.log("✅ Cleared all saved areas");
    return true;
  } catch (error) {
    console.error("❌ Error clearing areas:", error);
    return false;
  }
};

/**
 * Manually set selected areas (for testing)
 */
export const debugSetAreas = async (areaIds) => {
  try {
    await AsyncStorage.setItem("selectedAreas", JSON.stringify(areaIds));
    const areaNames = areaIds.map(id => {
      const area = MUMBAI_AREAS.find(a => a.id === id);
      return area ? area.name : `Unknown (${id})`;
    });
    console.log("✅ Set areas:", areaNames.join(", "));
    return true;
  } catch (error) {
    console.error("❌ Error setting areas:", error);
    return false;
  }
};

/**
 * Test nearest area detection with custom coordinates
 */
export const debugNearestArea = (lat, lng) => {
  console.log(`🎯 Testing coordinates: ${lat}, ${lng}`);
  const nearest = findNearestArea(lat, lng);
  if (nearest) {
    console.log(`📍 Nearest area: ${nearest.name}`);
    console.log(`📏 Distance: ${nearest.distance} km`);
    console.log(`🏷️  Zone: ${nearest.zone}`);
    console.log(`🆔 ID: ${nearest.id}`);
    return nearest;
  } else {
    console.log("❌ No nearest area found");
    return null;
  }
};

/**
 * List all areas with distances from given coordinates
 */
export const debugAllDistances = (lat, lng) => {
  console.log(`📊 Calculating distances from: ${lat}, ${lng}`);
  const areas = getAreasWithDistances(lat, lng);
  console.log(`\n📍 Areas sorted by distance:\n`);
  areas.slice(0, 10).forEach((area, idx) => {
    console.log(`${idx + 1}. ${area.name} - ${area.distance} km (${area.zone})`);
  });
  console.log(`\n... and ${areas.length - 10} more areas\n`);
  return areas;
};

/**
 * Test area filtering logic
 */
export const debugAreaFilter = (turfArea, selectedAreaIds) => {
  console.log(`🔍 Testing filter for turf area: "${turfArea}"`);
  console.log(`📋 Selected area IDs:`, selectedAreaIds);

  const matchesAnyArea = selectedAreaIds.some(areaId => {
    const area = MUMBAI_AREAS.find(a => a.id === areaId);
    const matches = area && area.name.toLowerCase() === turfArea.toLowerCase();
    if (matches) {
      console.log(`✅ Matched: ${area.name}`);
    }
    return matches;
  });

  console.log(`Result: ${matchesAnyArea ? "PASS ✅" : "FAIL ❌"}`);
  return matchesAnyArea;
};

/**
 * Validate turf location data
 */
export const debugValidateTurfLocation = (turf) => {
  console.log(`🏟️  Validating turf: ${turf.name || "Unnamed"}`);

  const issues = [];

  if (!turf.location) {
    issues.push("❌ Missing location object");
  } else if (typeof turf.location === "string") {
    issues.push("⚠️  Location is string, should be object");
  } else {
    if (!turf.location.area) {
      issues.push("⚠️  Missing location.area");
    } else {
      const matchingArea = MUMBAI_AREAS.find(a =>
        a.name.toLowerCase() === turf.location.area.toLowerCase()
      );
      if (!matchingArea) {
        issues.push(`⚠️  Area "${turf.location.area}" not in MUMBAI_AREAS`);
      } else {
        console.log(`✅ Area matches: ${matchingArea.name}`);
      }
    }

    if (!turf.location.coordinates) {
      issues.push("⚠️  Missing coordinates");
    } else {
      const { latitude, longitude, lat, lng, lon } = turf.location.coordinates;
      const turfLat = latitude ?? lat;
      const turfLng = longitude ?? lng ?? lon;

      if (turfLat == null || turfLng == null) {
        issues.push("❌ Invalid coordinates");
      } else if (turfLat < 18.8 || turfLat > 19.5 || turfLng < 72.7 || turfLng > 73.1) {
        issues.push(`⚠️  Coordinates outside Mumbai range: ${turfLat}, ${turfLng}`);
      } else {
        console.log(`✅ Valid coordinates: ${turfLat}, ${turfLng}`);
      }
    }
  }

  if (issues.length === 0) {
    console.log("✅ All validations passed!");
    return true;
  } else {
    console.log("\nIssues found:");
    issues.forEach(issue => console.log(issue));
    return false;
  }
};

/**
 * Print summary of all Mumbai areas
 */
export const debugAreasSummary = () => {
  const zones = {
    Western: [],
    Central: [],
    South: [],
    Eastern: [],
  };

  MUMBAI_AREAS.forEach(area => {
    if (zones[area.zone]) {
      zones[area.zone].push(area.name);
    }
  });

  console.log("\n📍 MUMBAI AREAS SUMMARY\n");
  console.log(`Total areas: ${MUMBAI_AREAS.length}\n`);

  Object.entries(zones).forEach(([zone, areas]) => {
    console.log(`${zone} (${areas.length}):`);
    areas.forEach(name => console.log(`  - ${name}`));
    console.log("");
  });
};

/**
 * Quick test suite - run all tests
 */
export const debugRunTests = async () => {
  console.log("\n🧪 RUNNING LOCATION SYSTEM TESTS\n");
  console.log("=".repeat(50));

  // Test 1: Areas summary
  console.log("\nTest 1: Areas Summary");
  debugAreasSummary();

  // Test 2: Saved areas
  console.log("\nTest 2: Saved Areas");
  await debugSavedAreas();

  // Test 3: Nearest area (Andheri West coordinates)
  console.log("\nTest 3: Nearest Area Detection");
  debugNearestArea(19.1368, 72.8264);

  // Test 4: Distance calculation
  console.log("\nTest 4: Distance Calculation");
  debugAllDistances(19.1368, 72.8264);

  // Test 5: Area filtering
  console.log("\nTest 5: Area Filter Logic");
  debugAreaFilter("Andheri West", ["andheri-west", "bandra-west"]);
  debugAreaFilter("Powai", ["andheri-west", "bandra-west"]);

  // Test 6: Sample turf validation
  console.log("\nTest 6: Turf Validation");
  debugValidateTurfLocation({
    name: "Sample Turf",
    location: {
      area: "Andheri West",
      coordinates: {
        latitude: 19.1368,
        longitude: 72.8264,
      },
    },
  });

  console.log("\n" + "=".repeat(50));
  console.log("🧪 TESTS COMPLETE\n");
};

/**
 * Helper to format area IDs for display
 */
export const debugFormatAreaIds = (areaIds) => {
  return areaIds.map(id => {
    const area = MUMBAI_AREAS.find(a => a.id === id);
    return area ? `${area.name} (${id})` : `Unknown (${id})`;
  }).join("\n");
};

/**
 * Find areas by search query
 */
export const debugSearchAreas = (query) => {
  const lowerQuery = query.toLowerCase();
  const matches = MUMBAI_AREAS.filter(area =>
    area.name.toLowerCase().includes(lowerQuery)
  );

  console.log(`🔍 Search results for "${query}":`);
  if (matches.length > 0) {
    matches.forEach(area => {
      console.log(`  - ${area.name} (${area.zone}, ${area.id})`);
    });
  } else {
    console.log("  No matches found");
  }

  return matches;
};

/**
 * Usage examples - uncomment in HomeScreen to test
 */
export const USAGE_EXAMPLES = `
// Import in HomeScreen.js:
import {
  debugSavedAreas,
  debugClearSavedAreas,
  debugNearestArea,
  debugRunTests
} from '../../utils/locationDebug';

// Add to useEffect or button handler:
useEffect(() => {
  // Run full test suite
  debugRunTests();

  // Or individual tests:
  debugSavedAreas();
  debugNearestArea(19.1368, 72.8264); // Andheri West

  // Clear saved areas to test fresh install
  debugClearSavedAreas();
}, []);

// Test specific area matching:
debugAreaFilter("Andheri West", selectedAreas);

// Validate turf data:
turfs.forEach(turf => debugValidateTurfLocation(turf));
`;

// Default export for easy importing
export default {
  debugSavedAreas,
  debugClearSavedAreas,
  debugSetAreas,
  debugNearestArea,
  debugAllDistances,
  debugAreaFilter,
  debugValidateTurfLocation,
  debugAreasSummary,
  debugRunTests,
  debugFormatAreaIds,
  debugSearchAreas,
};
