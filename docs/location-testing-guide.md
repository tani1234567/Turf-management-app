# Location System Testing Guide

## Test Environment Setup

### Prerequisites
1. Expo dev client installed on device
2. Location services enabled on device
3. App has location permission granted
4. Sample turfs with Mumbai area data in Firestore

### Sample Turf Data Format
Ensure turfs in Firestore have this structure:
```json
{
  "name": "Green Field Arena",
  "location": {
    "area": "Andheri West",  // Must match MUMBAI_AREAS name exactly
    "city": "Mumbai",
    "coordinates": {
      "latitude": 19.1368,
      "longitude": 72.8264
    }
  }
}
```

## Test Scenarios

### 1. First-Time User Flow

#### Test Case 1.1: Location Permission Granted
**Steps:**
1. Fresh install app (or clear AsyncStorage)
2. Navigate to Home screen
3. Grant location permission when prompted

**Expected Results:**
- ✅ GPS coordinates captured
- ✅ Nearest area auto-detected
- ✅ Nearest area auto-selected
- ✅ Location button shows area name
- ✅ Turfs filtered by selected area
- ✅ Selection saved to AsyncStorage

**Verify:**
```javascript
// Check AsyncStorage
AsyncStorage.getItem("selectedAreas") // Should return: ["andheri-west"]
```

#### Test Case 1.2: Location Permission Denied
**Steps:**
1. Fresh install app
2. Navigate to Home screen
3. Deny location permission

**Expected Results:**
- ✅ Location button shows "All Areas"
- ✅ No auto-selection
- ✅ All turfs visible
- ✅ Areas list shows without distances
- ✅ No nearest area banner in modal

### 2. Location Modal Functionality

#### Test Case 2.1: Opening Modal
**Steps:**
1. Tap location button in header

**Expected Results:**
- ✅ Modal slides up smoothly
- ✅ Header shows "Select Areas"
- ✅ Shows current selection count
- ✅ Nearest area banner visible (if location granted and no selection)
- ✅ Search bar present
- ✅ Zone chips visible
- ✅ Areas sorted by distance

#### Test Case 2.2: Nearest Area Banner
**Steps:**
1. Open modal with location granted
2. Ensure no areas selected
3. Verify banner content
4. Tap "Select" button

**Expected Results:**
- ✅ Banner shows GPS icon
- ✅ Displays nearest area name
- ✅ Shows distance in km
- ✅ "Select" button visible
- ✅ Tapping selects the area
- ✅ Banner disappears after selection
- ✅ Area appears selected in list

#### Test Case 2.3: Search Functionality
**Steps:**
1. Open location modal
2. Type "andheri" in search bar
3. Verify results
4. Type "xyz123" (non-existent)

**Expected Results:**
- ✅ Real-time filtering
- ✅ Shows both "Andheri West" and "Andheri East"
- ✅ Case-insensitive matching
- ✅ Shows empty state for no results
- ✅ Empty state shows map icon and message

#### Test Case 2.4: Zone Filtering
**Steps:**
1. Open modal
2. Tap "Western" chip
3. Verify list
4. Tap "Central" chip
5. Tap "All" chip

**Expected Results:**
- ✅ Selected chip turns green
- ✅ List shows only Western areas
- ✅ Previously selected chip deselects
- ✅ List updates to Central areas
- ✅ "All" shows all areas again
- ✅ Filters work with search

#### Test Case 2.5: Single Area Selection
**Steps:**
1. Open modal with no selection
2. Tap "Bandra West"
3. Observe changes
4. Close modal
5. Reopen modal

**Expected Results:**
- ✅ Checkbox fills with green
- ✅ Row background turns light green
- ✅ Check mark appears on right
- ✅ Text becomes bold and green
- ✅ Subtitle shows "1 area selected"
- ✅ Selection persists after closing
- ✅ Area remains selected on reopen

#### Test Case 2.6: Multi-Area Selection
**Steps:**
1. Open modal
2. Select "Andheri West"
3. Select "Andheri East"
4. Select "Goregaon West"
5. Verify header
6. Close modal

**Expected Results:**
- ✅ All 3 areas show selected state
- ✅ All 3 have green backgrounds
- ✅ Subtitle shows "3 areas selected"
- ✅ Location button shows "3 Areas"
- ✅ All selections persisted

#### Test Case 2.7: Deselection
**Steps:**
1. Select multiple areas
2. Tap a selected area again
3. Verify changes

**Expected Results:**
- ✅ Checkbox empties
- ✅ Background returns to white
- ✅ Check mark disappears
- ✅ Text returns to normal weight
- ✅ Count updates in subtitle

#### Test Case 2.8: Clear All
**Steps:**
1. Select 3+ areas
2. Tap "Clear All" button
3. Verify state

**Expected Results:**
- ✅ All selections removed
- ✅ All checkboxes empty
- ✅ All backgrounds white
- ✅ Subtitle updates
- ✅ Location button shows "All Areas"
- ✅ AsyncStorage cleared

#### Test Case 2.9: Distance Display
**Steps:**
1. Grant location permission
2. Open modal
3. Check each area item

**Expected Results:**
- ✅ All areas show distance
- ✅ Distance format: "X.X km"
- ✅ Sorted nearest to farthest
- ✅ Distance icon visible
- ✅ Reasonable values (0-50 km range)

### 3. Turf Filtering

#### Test Case 3.1: Single Area Filter
**Steps:**
1. Select "Andheri West" only
2. Close modal
3. Observe turf list

**Expected Results:**
- ✅ Only turfs with `location.area = "Andheri West"` shown
- ✅ Results count updates
- ✅ Other filters still work
- ✅ Search still functional

#### Test Case 3.2: Multi-Area Filter
**Steps:**
1. Select "Andheri West", "Bandra West", "Powai"
2. Close modal
3. Observe turf list

**Expected Results:**
- ✅ Turfs from all 3 areas shown
- ✅ Turfs from other areas hidden
- ✅ Results count reflects combined areas
- ✅ Location button shows "3 Areas"

#### Test Case 3.3: No Matching Turfs
**Steps:**
1. Select area with no turfs (e.g., "Malabar Hill")
2. Close modal

**Expected Results:**
- ✅ Empty state shown
- ✅ "No turfs found" message
- ✅ "Clear Filters" button visible
- ✅ Tapping clears area selection

#### Test Case 3.4: Combined Filters
**Steps:**
1. Select "Andheri West"
2. Select sport: "Football"
3. Set price range: ₹500-1000
4. Set min rating: 4.0

**Expected Results:**
- ✅ All filters apply together
- ✅ Filter badge shows count (includes area)
- ✅ Only matching turfs shown
- ✅ Can clear all filters at once

### 4. Persistence & State Management

#### Test Case 4.1: App Restart
**Steps:**
1. Select 2 areas
2. Close app completely
3. Restart app
4. Navigate to Home

**Expected Results:**
- ✅ Selected areas restored
- ✅ Location button shows count
- ✅ Turfs filtered correctly
- ✅ Opening modal shows selections

#### Test Case 4.2: AsyncStorage Verification
**Steps:**
```javascript
// In app, select areas then run:
import AsyncStorage from '@react-native-async-storage/async-storage';

// Check saved data
AsyncStorage.getItem("selectedAreas").then(data => {
  console.log("Saved areas:", JSON.parse(data));
});
```

**Expected Results:**
- ✅ Array of area IDs
- ✅ Matches current selection
- ✅ Updates on each change

#### Test Case 4.3: Selection Sync
**Steps:**
1. Select areas in modal
2. Close modal
3. Reopen modal immediately

**Expected Results:**
- ✅ Same areas selected
- ✅ No flickering or state loss
- ✅ Counts match

### 5. Edge Cases

#### Test Case 5.1: GPS Accuracy
**Steps:**
1. Test with poor GPS signal
2. Test indoors vs outdoors
3. Test with mock location

**Expected Results:**
- ✅ Handles inaccurate coordinates gracefully
- ✅ No crashes with bad data
- ✅ Fallback to area list without distances

#### Test Case 5.2: Turf with Invalid Area
**Steps:**
1. Create turf with `location.area = "Unknown Area"`
2. Refresh turf list

**Expected Results:**
- ✅ Turf appears in "All Areas" mode
- ✅ Doesn't appear in any specific area filter
- ✅ No crashes

#### Test Case 5.3: Turf with Missing Location
**Steps:**
1. Create turf without location object
2. Create turf with `location: "string instead of object"`

**Expected Results:**
- ✅ Handled gracefully in filter logic
- ✅ No crashes
- ✅ Only shows in "All Areas" mode

#### Test Case 5.4: Very Long Area Names
**Steps:**
1. Select area with long name
2. Check header button

**Expected Results:**
- ✅ Text truncates with ellipsis
- ✅ Button doesn't overflow
- ✅ Still readable

#### Test Case 5.5: Rapid Toggling
**Steps:**
1. Quickly tap multiple areas
2. Tap same area repeatedly
3. Spam "Clear All"

**Expected Results:**
- ✅ No UI freezing
- ✅ State updates correctly
- ✅ AsyncStorage handles debouncing
- ✅ No duplicate selections

### 6. Performance Testing

#### Test Case 6.1: Modal Open Speed
**Steps:**
1. Tap location button
2. Measure time to full render

**Expected Results:**
- ✅ Opens in < 300ms
- ✅ Smooth animation
- ✅ No lag on lower-end devices

#### Test Case 6.2: Search Performance
**Steps:**
1. Type rapidly in search bar
2. Switch zones quickly

**Expected Results:**
- ✅ Instant filtering (< 100ms)
- ✅ No dropped frames
- ✅ Smooth typing experience

#### Test Case 6.3: Large Selection
**Steps:**
1. Select all Western areas (~15 areas)
2. Close modal
3. Observe turf filtering

**Expected Results:**
- ✅ No lag when filtering
- ✅ Turf list updates smoothly
- ✅ Correct results

### 7. Visual Regression Testing

#### Test Case 7.1: Typography
**Verify:**
- ✅ All text uses Ubuntu fonts
- ✅ Correct font weights (Regular/Medium/Bold)
- ✅ No system font fallbacks
- ✅ Proper spacing and alignment

#### Test Case 7.2: Colors
**Verify:**
- ✅ Primary green: #4CAF50
- ✅ Selected background: #F1F8F4
- ✅ Banner background: #E8F5E9
- ✅ Consistent across all states

#### Test Case 7.3: Icons
**Verify:**
- ✅ Map marker for areas
- ✅ Checkbox when selected
- ✅ GPS icon in banner
- ✅ Proper sizes (16-24px)

#### Test Case 7.4: Spacing
**Verify:**
- ✅ Consistent padding (14px vertical, 20px horizontal)
- ✅ Proper gaps between elements
- ✅ Aligned elements
- ✅ No overlapping

## Device-Specific Testing

### iOS Testing
- [ ] iPhone SE (small screen)
- [ ] iPhone 14 Pro (notch)
- [ ] iPad (large screen)

### Android Testing
- [ ] Low-end device (2GB RAM)
- [ ] Mid-range device
- [ ] Tablet

### Platform Differences
- [ ] Safe area handling
- [ ] Bottom sheet behavior
- [ ] Keyboard avoidance
- [ ] Permission prompts

## Automated Test Cases

### Unit Tests (Suggested)
```javascript
// mumbaiAreas.test.js
describe('Mumbai Areas Utils', () => {
  test('findNearestArea returns correct area', () => {
    const result = findNearestArea(19.1368, 72.8264);
    expect(result.id).toBe('andheri-west');
  });

  test('calculateDistance returns reasonable values', () => {
    const distance = calculateDistance(19.1, 72.8, 19.2, 72.9);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(20);
  });

  test('getAreasWithDistances sorts by distance', () => {
    const areas = getAreasWithDistances(19.1368, 72.8264);
    expect(areas[0].distance).toBeLessThan(areas[1].distance);
  });
});
```

## Regression Testing Checklist

After any changes to location system:
- [ ] Auto-detection still works
- [ ] Multi-selection functional
- [ ] Persistence working
- [ ] Filtering accurate
- [ ] Search responsive
- [ ] Zone filters work
- [ ] UI matches design
- [ ] No performance degradation

## Bug Report Template

```markdown
**Bug Title:** [Concise description]

**Severity:** [Critical/High/Medium/Low]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Screenshots/Video:**

**Device Info:**
- Device:
- OS Version:
- App Version:

**Additional Context:**
- Selected areas:
- Location permission:
- AsyncStorage state:
```

## Performance Benchmarks

### Target Metrics
- Modal open time: < 300ms
- Search response: < 100ms
- Filter application: < 200ms
- AsyncStorage save: < 50ms
- Distance calculation (60 areas): < 100ms

### Monitoring
```javascript
// Add performance logging
console.time('modalOpen');
setLocationModalVisible(true);
console.timeEnd('modalOpen');

console.time('distanceCalc');
const areas = getAreasWithDistances(lat, lng);
console.timeEnd('distanceCalc');
```

## User Acceptance Criteria

✅ **Must Have:**
- Auto-detect nearest area on first launch
- Multi-select areas
- Persist selection across sessions
- Filter turfs by selected areas
- Show distances from user location
- Search areas by name
- Filter by zone

✅ **Should Have:**
- Visual feedback for all interactions
- Empty states for edge cases
- Graceful error handling
- Performance < 300ms for all operations

✅ **Nice to Have:**
- Animations for state changes
- Haptic feedback on selection
- Area popularity indicators
- Map view integration

## Sign-Off Checklist

Before marking as complete:
- [ ] All test cases pass
- [ ] No console errors
- [ ] Tested on iOS and Android
- [ ] Performance meets benchmarks
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] AsyncStorage working
- [ ] Location permission handling correct
- [ ] UI matches design specs
- [ ] Edge cases handled
