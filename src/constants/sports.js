/**
 * Sports constants for the Turf Management System
 * Used for sport selection in booking flow and turf configuration
 */

export const SPORTS = [
  {
    id: 'cricket',
    name: 'Cricket',
    icon: 'cricket',
    color: '#4CAF50',
    minDuration: 1, // hours
    maxDuration: 8,
    defaultDuration: 2,
  },
  {
    id: 'football',
    name: 'Football',
    icon: 'soccer',
    color: '#2196F3',
    minDuration: 1,
    maxDuration: 4,
    defaultDuration: 1,
  },
  {
    id: 'badminton',
    name: 'Badminton',
    icon: 'badminton',
    color: '#FF9800',
    minDuration: 0.5,
    maxDuration: 3,
    defaultDuration: 1,
  },
  {
    id: 'tennis',
    name: 'Tennis',
    icon: 'tennis',
    color: '#9C27B0',
    minDuration: 0.5,
    maxDuration: 3,
    defaultDuration: 1,
  },
  {
    id: 'pickleball',
    name: 'Pickleball',
    icon: 'tennis',
    color: '#00BCD4',
    minDuration: 0.5,
    maxDuration: 2,
    defaultDuration: 1,
  },
  {
    id: 'basketball',
    name: 'Basketball',
    icon: 'basketball',
    color: '#FF5722',
    minDuration: 1,
    maxDuration: 3,
    defaultDuration: 1,
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    icon: 'volleyball',
    color: '#E91E63',
    minDuration: 1,
    maxDuration: 3,
    defaultDuration: 1,
  },
  {
    id: 'hockey',
    name: 'Hockey',
    icon: 'hockey-sticks',
    color: '#795548',
    minDuration: 1,
    maxDuration: 3,
    defaultDuration: 1,
  },
];

// Get sport by ID
export function getSportById(sportId) {
  return SPORTS.find(sport => sport.id === sportId);
}

// Get sport name by ID
export function getSportName(sportId) {
  const sport = getSportById(sportId);
  return sport ? sport.name : sportId;
}

// Get sport icon by ID
export function getSportIcon(sportId) {
  const sport = getSportById(sportId);
  return sport ? sport.icon : 'help-circle';
}

// Get sport color by ID
export function getSportColor(sportId) {
  const sport = getSportById(sportId);
  return sport ? sport.color : '#757575';
}

// Get list of sport IDs
export function getSportIds() {
  return SPORTS.map(sport => sport.id);
}

// Amenities that can be available at a ground
export const AMENITIES = [
  { id: 'floodlights', name: 'Floodlights', icon: 'lightbulb-on' },
  { id: 'changing_room', name: 'Changing Room', icon: 'door' },
  { id: 'parking', name: 'Parking', icon: 'car' },
  { id: 'water', name: 'Drinking Water', icon: 'water' },
  { id: 'restrooms', name: 'Restrooms', icon: 'toilet' },
  { id: 'cafeteria', name: 'Cafeteria', icon: 'food' },
  { id: 'first_aid', name: 'First Aid', icon: 'medical-bag' },
  { id: 'wifi', name: 'WiFi', icon: 'wifi' },
  { id: 'seating', name: 'Spectator Seating', icon: 'seat' },
  { id: 'equipment', name: 'Equipment Rental', icon: 'basketball' },
];

// Get amenity by ID
export function getAmenityById(amenityId) {
  return AMENITIES.find(amenity => amenity.id === amenityId);
}

// Time slot categories for pricing
export const TIME_SLOTS = {
  MORNING: {
    id: 'morning',
    name: 'Morning',
    defaultStart: '06:00',
    defaultEnd: '10:00',
  },
  AFTERNOON: {
    id: 'afternoon',
    name: 'Afternoon',
    defaultStart: '10:00',
    defaultEnd: '18:00',
  },
  EVENING: {
    id: 'evening',
    name: 'Evening',
    defaultStart: '18:00',
    defaultEnd: '23:00',
  },
};

// Day types for pricing
export const DAY_TYPES = {
  WEEKDAY: 'weekday',
  WEEKEND: 'weekend',
};

/**
 * Determine if a date is a weekend
 * @param {Date|string} date
 * @returns {boolean}
 */
export function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Get day type for a date
 * @param {Date|string} date
 * @returns {string} 'weekday' or 'weekend'
 */
export function getDayType(date) {
  return isWeekend(date) ? DAY_TYPES.WEEKEND : DAY_TYPES.WEEKDAY;
}

/**
 * Get time slot category based on hour
 * @param {string} time - Time in HH:MM format
 * @returns {string} 'morning', 'afternoon', or 'evening'
 */
export function getTimeSlotCategory(time) {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 18) return 'afternoon';
  return 'evening';
}

export default SPORTS;
