# Location System Migration Guide

## Overview
This guide helps migrate existing turfs to work with the new area-based location system.

## Data Structure Changes

### Old Format (Still Supported)
```json
{
  "location": {
    "city": "Mumbai",
    "district": "Western Suburbs",
    "area": "Andheri",  // Generic
    "address": "123 Main Road",
    "coordinates": {
      "latitude": 19.1368,
      "longitude": 72.8264
    }
  }
}
```

### New Format (Recommended)
```json
{
  "location": {
    "area": "Andheri West",  // Specific! Must match MUMBAI_AREAS
    "city": "Mumbai",
    "state": "Maharashtra",
    "address": "123 Main Road, Andheri West, Mumbai",
    "coordinates": {
      "latitude": 19.1368,
      "longitude": 72.8264
    },
    "googleMapsLink": "https://maps.google.com/?q=19.1368,72.8264"
  }
}
```

### Key Differences
1. **area field is now critical** - Must match exactly with MUMBAI_AREAS names
2. **Coordinates required** - For distance calculations
3. **Specificity matters** - "Andheri West" not just "Andheri"

## Area Name Mapping

### Generic → Specific Mapping

| Old Area Name | New Area Name(s) |
|---------------|------------------|
| Andheri | Andheri West, Andheri East |
| Borivali | Borivali West, Borivali East |
| Kandivali | Kandivali West, Kandivali East |
| Malad | Malad West, Malad East |
| Goregaon | Goregaon West, Goregaon East |
| Bandra | Bandra West, Bandra East |
| Santacruz | Santacruz West, Santacruz East |
| Khar | Khar West, Khar East |
| Vile Parle | Vile Parle West, Vile Parle East |
| Dadar | Dadar West, Dadar East |
| Kurla | Kurla West, Kurla East |
| Ghatkopar | Ghatkopar West, Ghatkopar East |
| Vikhroli | Vikhroli West, Vikhroli East |
| Mulund | Mulund West, Mulund East |
| Bhandup | Bhandup West, Bhandup East |

### Complete Area List
Refer to `src/constants/mumbaiAreas.js` for the complete list of 60+ areas.

## Migration Strategies

### Strategy 1: Manual Update (Small Dataset)

For apps with < 50 turfs, manually update each turf:

1. **Check current area:**
   ```javascript
   // In Firestore console or app
   console.log(turf.location.area);
   ```

2. **Update to specific area:**
   ```javascript
   // Update in Firestore
   await updateDocument("turfs", turfId, {
     "location.area": "Andheri West"  // or appropriate area
   });
   ```

3. **Verify coordinates:**
   ```javascript
   // Ensure coordinates exist
   if (!turf.location.coordinates) {
     // Add coordinates from Google Maps
     await updateDocument("turfs", turfId, {
       "location.coordinates": {
         latitude: 19.1368,
         longitude: 72.8264
       }
     });
   }
   ```

### Strategy 2: Batch Update Script (Large Dataset)

For apps with 50+ turfs, use a migration script:

```javascript
// scripts/migrateLocations.js
import admin from 'firebase-admin';
import { MUMBAI_AREAS } from '../src/constants/mumbaiAreas.js';

admin.initializeApp();
const db = admin.firestore();

async function migrateTurfLocations() {
  const turfsSnapshot = await db.collection('turfs').get();
  const batch = db.batch();
  let updateCount = 0;

  turfsSnapshot.forEach(doc => {
    const turf = doc.data();
    const location = turf.location;

    if (!location || typeof location === 'string') {
      console.log(`⚠️  Skipping ${turf.name} - invalid location`);
      return;
    }

    let needsUpdate = false;
    const updates = {};

    // Check if area needs specificity
    if (location.area && !isSpecificArea(location.area)) {
      const specificArea = inferSpecificArea(location);
      if (specificArea) {
        updates['location.area'] = specificArea;
        needsUpdate = true;
        console.log(`📍 ${turf.name}: "${location.area}" → "${specificArea}"`);
      }
    }

    // Check coordinates
    if (!location.coordinates || !location.coordinates.latitude) {
      console.log(`⚠️  ${turf.name} - missing coordinates, needs manual fix`);
    }

    if (needsUpdate) {
      batch.update(doc.ref, updates);
      updateCount++;
    }
  });

  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ Updated ${updateCount} turfs`);
  } else {
    console.log(`✅ No updates needed`);
  }
}

function isSpecificArea(areaName) {
  return MUMBAI_AREAS.some(a =>
    a.name.toLowerCase() === areaName.toLowerCase()
  );
}

function inferSpecificArea(location) {
  // Strategy 1: Use coordinates to find nearest area
  if (location.coordinates?.latitude && location.coordinates?.longitude) {
    const nearest = findNearestMumbaiArea(
      location.coordinates.latitude,
      location.coordinates.longitude
    );
    return nearest?.name;
  }

  // Strategy 2: Check address for East/West
  const address = location.address?.toLowerCase() || '';
  const currentArea = location.area?.toLowerCase() || '';

  if (address.includes('west') || address.includes('(w)')) {
    return `${location.area} West`;
  }
  if (address.includes('east') || address.includes('(e)')) {
    return `${location.area} East`;
  }

  // Strategy 3: Ask for manual review
  return null;
}

// Run migration
migrateTurfLocations().catch(console.error);
```

### Strategy 3: Geocoding (No Coordinates)

For turfs without coordinates:

```javascript
import Geocoder from 'react-native-geocoding';

Geocoder.init("YOUR_GOOGLE_MAPS_API_KEY");

async function geocodeTurf(turf) {
  const address = turf.location.address ||
    `${turf.location.area}, Mumbai, Maharashtra`;

  try {
    const json = await Geocoder.from(address);
    const location = json.results[0].geometry.location;

    await updateDocument("turfs", turf.id, {
      "location.coordinates": {
        latitude: location.lat,
        longitude: location.lng
      }
    });

    console.log(`✅ Geocoded ${turf.name}: ${location.lat}, ${location.lng}`);
  } catch (error) {
    console.error(`❌ Failed to geocode ${turf.name}:`, error);
  }
}
```

## Validation

### Validate Single Turf
```javascript
import { debugValidateTurfLocation } from '../utils/locationDebug';

// Check if turf data is valid
debugValidateTurfLocation(turf);
```

### Validate All Turfs
```javascript
const turfs = await queryDocuments("turfs", []);
const issues = [];

turfs.forEach(turf => {
  const area = turf.location?.area;

  // Check if area matches MUMBAI_AREAS
  const isValid = MUMBAI_AREAS.some(a =>
    a.name.toLowerCase() === area?.toLowerCase()
  );

  if (!isValid) {
    issues.push({
      id: turf.id,
      name: turf.name,
      area: area,
      issue: 'Area not in MUMBAI_AREAS'
    });
  }

  // Check coordinates
  if (!turf.location?.coordinates?.latitude) {
    issues.push({
      id: turf.id,
      name: turf.name,
      issue: 'Missing coordinates'
    });
  }
});

console.log(`Found ${issues.length} issues:`, issues);
```

## Common Migration Issues

### Issue 1: Generic Area Names
**Problem:** Turf has "Andheri" but system expects "Andheri West"

**Solution:**
```javascript
// Option A: Use coordinates to determine East/West
const coords = turf.location.coordinates;
const nearest = findNearestArea(coords.latitude, coords.longitude);
const specificArea = nearest.name; // "Andheri West"

// Option B: Check address
const address = turf.location.address.toLowerCase();
const specificArea = address.includes('west')
  ? 'Andheri West'
  : 'Andheri East';
```

### Issue 2: Missing Coordinates
**Problem:** Old turfs don't have lat/lng

**Solutions:**
1. Extract from Google Maps link
2. Geocode the address
3. Use area center coordinates as fallback

```javascript
// Fallback to area center
const area = MUMBAI_AREAS.find(a => a.name === turf.location.area);
const fallbackCoords = {
  latitude: area.lat,
  longitude: area.lng
};
```

### Issue 3: Coordinates Outside Mumbai
**Problem:** Invalid or incorrect coordinates

**Validation:**
```javascript
const isInMumbai = (lat, lng) => {
  return lat >= 18.8 && lat <= 19.5 &&
         lng >= 72.7 && lng <= 73.1;
};

if (!isInMumbai(coords.latitude, coords.longitude)) {
  console.error('Invalid coordinates for Mumbai');
}
```

### Issue 4: Case Sensitivity
**Problem:** "andheri west" vs "Andheri West"

**Solution:** Filter handles this automatically:
```javascript
// Filter uses case-insensitive matching
area.name.toLowerCase() === turfArea.toLowerCase()
```

## Testing After Migration

### Test Checklist
1. [ ] All turfs have valid area names
2. [ ] All turfs have coordinates
3. [ ] Turfs appear in correct area filters
4. [ ] Distance calculations work
5. [ ] No console errors
6. [ ] Empty states don't show for valid areas

### Test Query
```javascript
// Get all turfs and check area coverage
const turfs = await queryDocuments("turfs", []);
const areaCounts = {};

turfs.forEach(turf => {
  const area = turf.location?.area || 'Unknown';
  areaCounts[area] = (areaCounts[area] || 0) + 1;
});

console.log('Turfs per area:', areaCounts);

// Check for orphaned areas
Object.keys(areaCounts).forEach(area => {
  const isValid = MUMBAI_AREAS.some(a =>
    a.name.toLowerCase() === area.toLowerCase()
  );
  if (!isValid && area !== 'Unknown') {
    console.warn(`⚠️  Orphaned area: ${area} (${areaCounts[area]} turfs)`);
  }
});
```

## Rollback Plan

If migration causes issues:

### Option 1: Revert Code
```bash
git revert <commit-hash>
npm install
npx expo start --clear
```

### Option 2: Keep New System, Update Data
The new system is backward compatible - it just won't filter correctly until data is updated.

### Option 3: Temporary Compatibility Mode
Add to filter logic:
```javascript
// In HomeScreen.js, update area filter
const matchesAnyArea = selectedAreas.some(areaId => {
  const area = MUMBAI_AREAS.find(a => a.id === areaId);
  const turfAreaLower = turfArea.toLowerCase();
  const areaNameLower = area.name.toLowerCase();

  // Exact match
  if (areaNameLower === turfAreaLower) return true;

  // Partial match (backward compatibility)
  if (areaNameLower.includes(turfAreaLower) ||
      turfAreaLower.includes(areaNameLower.split(' ')[0])) {
    return true;
  }

  return false;
});
```

## Migration Timeline

### Recommended Approach

**Week 1: Preparation**
- [ ] Audit current turf data
- [ ] Identify turfs needing updates
- [ ] Prepare geocoding/migration scripts
- [ ] Test migration on staging

**Week 2: Migration**
- [ ] Backup Firestore data
- [ ] Run migration script
- [ ] Validate results
- [ ] Fix any issues

**Week 3: Deploy**
- [ ] Deploy new app version
- [ ] Monitor user feedback
- [ ] Fix edge cases
- [ ] Update documentation

## Support

If you encounter issues during migration:

1. **Check validation:**
   ```javascript
   import { debugRunTests } from '../utils/locationDebug';
   debugRunTests();
   ```

2. **Review logs:**
   Look for warnings in console about invalid areas

3. **Verify Firestore:**
   Check actual turf documents in Firestore console

4. **Test filtering:**
   Select each area and verify turfs appear

## Firestore Data Export/Import

### Export Before Migration
```bash
# Using Firebase CLI
firebase firestore:export gs://your-bucket/backup-$(date +%Y%m%d)

# Or use Firestore console: Export/Import feature
```

### Import If Rollback Needed
```bash
firebase firestore:import gs://your-bucket/backup-20260220
```

## Sample Migration Script

Complete example with error handling:

```javascript
// migrate.js
const updateTurfLocation = async (turfId, currentArea, coords) => {
  try {
    // Find matching MUMBAI_AREAS entry
    const nearest = findNearestArea(coords.lat, coords.lng);

    if (!nearest) {
      console.error(`No matching area for ${currentArea}`);
      return false;
    }

    // Update Firestore
    await updateDocument("turfs", turfId, {
      "location.area": nearest.name,
      "location.coordinates": {
        latitude: coords.lat,
        longitude: coords.lng
      }
    });

    console.log(`✅ Updated: ${currentArea} → ${nearest.name}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${turfId}:`, error);
    return false;
  }
};

// Usage
await updateTurfLocation(
  "turf123",
  "Andheri",
  { lat: 19.1368, lng: 72.8264 }
);
```
