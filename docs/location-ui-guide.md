# Location Selection UI Guide

## Visual Layout

### 1. Header Location Button

**Before:**
```
┌─────────────────────┐
│ 📍 Mumbai        ▼ │
└─────────────────────┘
```

**After:**
```
┌─────────────────────┐
│ 📍 3 Areas       ▼ │  (when multiple selected)
└─────────────────────┘

┌─────────────────────┐
│ 📍 Andheri West  ▼ │  (when one selected)
└─────────────────────┘

┌─────────────────────┐
│ 📍 All Areas     ▼ │  (when none selected)
└─────────────────────┘
```

### 2. Enhanced Location Modal

```
╔════════════════════════════════════╗
║  Select Areas              [X]     ║
║  3 areas selected                  ║
╟────────────────────────────────────╢
║ ┌────────────────────────────────┐ ║
║ │ 🎯 Nearest to you              │ ║  <- Only shown when location granted
║ │ Andheri West (2.3 km)          │ ║     and no areas selected
║ │                      [Select]  │ ║
║ └────────────────────────────────┘ ║
╟────────────────────────────────────╢
║ ┌────────────────────────────────┐ ║
║ │ 🔍 Search Mumbai areas...      │ ║
║ └────────────────────────────────┘ ║
╟────────────────────────────────────╢
║ [All] [Western] [Central] [South]  ║  <- Zone filter chips
║  [Eastern]                         ║
╟────────────────────────────────────╢
║ ┌────────────────────────────────┐ ║
║ │ 🌍 All Areas                   │ ║  <- Clear all option
║ │    Clear selection        ✕    │ ║
║ ├────────────────────────────────┤ ║
║ │ ☑️ Andheri West                │ ║  <- Selected (green bg)
║ │    Western • 📍 2.3 km    ✓    │ ║
║ ├────────────────────────────────┤ ║
║ │ ☑️ Andheri East                │ ║  <- Selected
║ │    Western • 📍 3.1 km    ✓    │ ║
║ ├────────────────────────────────┤ ║
║ │ ⭕ Goregaon West               │ ║  <- Not selected
║ │    Western • 📍 5.2 km         │ ║
║ ├────────────────────────────────┤ ║
║ │ ⭕ Bandra West                 │ ║
║ │    Western • 📍 6.8 km         │ ║
║ ├────────────────────────────────┤ ║
║ │ ⭕ Powai                       │ ║
║ │    Central • 📍 7.1 km         │ ║
║ └────────────────────────────────┘ ║
╟────────────────────────────────────╢
║        [Clear All]     [Done]      ║
╚════════════════════════════════════╝
```

### 3. Empty State

```
╔════════════════════════════════════╗
║  Select Areas              [X]     ║
╟────────────────────────────────────╢
║ ┌────────────────────────────────┐ ║
║ │ 🔍 Search Mumbai areas...      │ ║
║ └────────────────────────────────┘ ║
╟────────────────────────────────────╢
║ [All] [Western] [Central] [South]  ║
║  [Eastern]                         ║
╟────────────────────────────────────╢
║                                    ║
║           🗺️                       ║
║      No areas found                ║
║   Try adjusting your search        ║
║      or zone filter                ║
║                                    ║
╚════════════════════════════════════╝
```

## UI Elements Breakdown

### Header Location Button
- **Container:** Light green background (#E8F5E9)
- **Icon:** Green map marker (16px)
- **Text:** Dynamic based on selection
  - Ubuntu-Regular font
  - Truncates if too long
- **Chevron:** Down arrow indicating dropdown

### Modal Header
- **Title:** "Select Areas" in Ubuntu-Bold
- **Subtitle:** Selection count in green
- **Close button:** X icon (top-right)

### Nearest Area Banner
- **Background:** Pale green (#E8F5E9)
- **Icon:** GPS crosshairs (green)
- **Layout:**
  - Left: GPS icon
  - Center: Area name + distance
  - Right: "Select" button
- **Visibility:** Only when:
  - Location permission granted
  - No areas currently selected
  - User has coordinates

### Search Bar
- **Placeholder:** "Search Mumbai areas..."
- **Style:** Light gray background (#f5f5f5)
- **Behavior:**
  - Real-time filtering
  - Case-insensitive
  - Searches area names

### Zone Filter
- **Layout:** Horizontal scrollable chips
- **Options:** All, Western, Central, South, Eastern
- **Selected state:**
  - Green background (#4CAF50)
  - White text
- **Unselected state:**
  - Light gray background (#f5f5f5)
  - Dark gray text

### Area List Items
- **Layout (each row):**
  ```
  [Icon] Area Name              [Check]
         Zone • 📍 Distance
  ```
- **Selected state:**
  - Checkbox icon (filled)
  - Green background tint (#F1F8F4)
  - Bold text (Ubuntu-Medium)
  - Green check mark
- **Unselected state:**
  - Map marker icon (outline)
  - White background
  - Regular text (Ubuntu-Regular)
  - No check mark

### Area Metadata
- **Zone badge:** Small gray text (Western, Central, etc.)
- **Separator:** Dot (•)
- **Distance:**
  - Map marker distance icon
  - Kilometers with 1 decimal (e.g., "2.3 km")
  - Only shown if location available

### Action Buttons
- **Clear All:**
  - Text button
  - Gray
  - Disabled when no selection
- **Done:**
  - Contained button
  - Green (#4CAF50)
  - Always enabled

## Interaction Flow

### Opening Modal
1. User taps location button in header
2. Modal slides up from bottom
3. If nearest area detected → shows banner
4. All areas listed, sorted by distance

### Selecting Areas
1. User taps an area row
2. Checkbox animates to filled
3. Row background changes to light green
4. Check mark appears on right
5. Header subtitle updates count

### Deselecting Areas
1. User taps selected area row
2. Checkbox animates to outline
3. Background returns to white
4. Check mark disappears
5. Header subtitle updates count

### Using Quick Select
1. User taps "Select" on nearest area banner
2. Area immediately selected
3. Banner disappears
4. Area shows in list as selected

### Filtering by Zone
1. User taps zone chip
2. Chip changes to green
3. List filters to show only that zone
4. Search continues to work within filtered results

### Searching
1. User types in search bar
2. List filters in real-time
3. Shows matching areas only
4. Zone filter still applies

### Clearing All
1. User taps "Clear All" button
2. All checkboxes deselect
3. Backgrounds return to white
4. Header shows "All Areas"
5. Filters reset

### Closing Modal
1. User taps "Done" or X
2. Modal slides down
3. Selections saved to AsyncStorage
4. Turf list refreshes with new filter

## Color Palette

| Element | Color | Hex Code |
|---------|-------|----------|
| Primary | Green | #4CAF50 |
| Selected Background | Light Green | #F1F8F4 |
| Banner Background | Pale Green | #E8F5E9 |
| Search Background | Light Gray | #f5f5f5 |
| Text Primary | Dark Gray | #333 |
| Text Secondary | Medium Gray | #666 |
| Text Tertiary | Light Gray | #999 |
| Divider | Very Light Gray | #eee |
| White | White | #fff |

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Modal Title | Ubuntu-Bold | 22px | 700 |
| Subtitle | Ubuntu-Regular | 12px | 400 |
| Area Name (Selected) | Ubuntu-Medium | 15px | 500 |
| Area Name (Normal) | Ubuntu-Regular | 15px | 400 |
| Zone Badge | Ubuntu-Regular | 11px | 400 |
| Distance | Ubuntu-Regular | 11px | 400 |
| Search Placeholder | Ubuntu-Regular | 14px | 400 |
| Zone Chip | Ubuntu-Medium | 12px | 500 |

## Spacing

| Element | Padding/Margin |
|---------|----------------|
| Modal Header | 24px (L), 8px (R), 16px (T), 8px (B) |
| Search Wrapper | 16px (H), 12px (B) |
| Area Item | 14px (V), 20px (H) |
| Zone Chips Gap | 8px |
| Icon-Text Gap | 12px |
| Banner Gap | 12px |

## Accessibility

- **Touch Targets:** Minimum 44px height for all interactive elements
- **Color Contrast:**
  - Text on white: 4.5:1 ratio
  - Selected text on green: WCAG AA compliant
- **Icons:** All icons have semantic meaning
- **States:** Clear visual feedback for all states
- **Labels:** Descriptive text for screen readers

## Responsive Behavior

- **Modal Height:** Max 85% of screen
- **Scrolling:**
  - Zone chips: Horizontal scroll if overflow
  - Area list: Vertical scroll with max height 400px
- **Search Bar:** Full width minus padding
- **Buttons:** Flexible width, proper spacing
