/**
 * Mumbai Areas with approximate coordinates for location detection
 * Coordinates represent central points of each area
 */
export const MUMBAI_AREAS = [
  // Western Suburbs - North
  { id: "borivali-west", name: "Borivali West", lat: 19.2308, lng: 72.8567, zone: "Western" },
  { id: "borivali-east", name: "Borivali East", lat: 19.2403, lng: 72.8583, zone: "Western" },
  { id: "kandivali-west", name: "Kandivali West", lat: 19.2067, lng: 72.8304, zone: "Western" },
  { id: "kandivali-east", name: "Kandivali East", lat: 19.2084, lng: 72.8501, zone: "Western" },
  { id: "malad-west", name: "Malad West", lat: 19.1863, lng: 72.8325, zone: "Western" },
  { id: "malad-east", name: "Malad East", lat: 19.1840, lng: 72.8480, zone: "Western" },
  { id: "goregaon-west", name: "Goregaon West", lat: 19.1677, lng: 72.8497, zone: "Western" },
  { id: "goregaon-east", name: "Goregaon East", lat: 19.1640, lng: 72.8629, zone: "Western" },

  // Western Suburbs - Central
  { id: "andheri-west", name: "Andheri West", lat: 19.1368, lng: 72.8264, zone: "Western" },
  { id: "andheri-east", name: "Andheri East", lat: 19.1197, lng: 72.8682, zone: "Western" },
  { id: "jogeshwari-west", name: "Jogeshwari West", lat: 19.1389, lng: 72.8409, zone: "Western" },
  { id: "jogeshwari-east", name: "Jogeshwari East", lat: 19.1345, lng: 72.8567, zone: "Western" },
  { id: "vile-parle-west", name: "Vile Parle West", lat: 19.1080, lng: 72.8385, zone: "Western" },
  { id: "vile-parle-east", name: "Vile Parle East", lat: 19.1005, lng: 72.8561, zone: "Western" },
  { id: "santacruz-west", name: "Santacruz West", lat: 19.0814, lng: 72.8317, zone: "Western" },
  { id: "santacruz-east", name: "Santacruz East", lat: 19.0766, lng: 72.8540, zone: "Western" },
  { id: "khar-west", name: "Khar West", lat: 19.0689, lng: 72.8344, zone: "Western" },
  { id: "khar-east", name: "Khar East", lat: 19.0708, lng: 72.8427, zone: "Western" },
  { id: "bandra-west", name: "Bandra West", lat: 19.0596, lng: 72.8295, zone: "Western" },
  { id: "bandra-east", name: "Bandra East", lat: 19.0544, lng: 72.8467, zone: "Western" },

  // Central Mumbai
  { id: "mahim", name: "Mahim", lat: 19.0410, lng: 72.8406, zone: "Central" },
  { id: "dadar-west", name: "Dadar West", lat: 19.0188, lng: 72.8439, zone: "Central" },
  { id: "dadar-east", name: "Dadar East", lat: 19.0178, lng: 72.8478, zone: "Central" },
  { id: "matunga", name: "Matunga", lat: 19.0263, lng: 72.8556, zone: "Central" },
  { id: "wadala", name: "Wadala", lat: 19.0161, lng: 72.8635, zone: "Central" },
  { id: "sion", name: "Sion", lat: 19.0433, lng: 72.8640, zone: "Central" },
  { id: "kurla-west", name: "Kurla West", lat: 19.0728, lng: 72.8826, zone: "Central" },
  { id: "kurla-east", name: "Kurla East", lat: 19.0688, lng: 72.8894, zone: "Central" },
  { id: "ghatkopar-west", name: "Ghatkopar West", lat: 19.0866, lng: 72.9081, zone: "Central" },
  { id: "ghatkopar-east", name: "Ghatkopar East", lat: 19.0770, lng: 72.9087, zone: "Central" },
  { id: "vikhroli-west", name: "Vikhroli West", lat: 19.1100, lng: 72.9258, zone: "Central" },
  { id: "vikhroli-east", name: "Vikhroli East", lat: 19.1065, lng: 72.9415, zone: "Central" },
  { id: "powai", name: "Powai", lat: 19.1197, lng: 72.9059, zone: "Central" },

  // South Mumbai
  { id: "lower-parel", name: "Lower Parel", lat: 18.9967, lng: 72.8302, zone: "South" },
  { id: "prabhadevi", name: "Prabhadevi", lat: 19.0150, lng: 72.8291, zone: "South" },
  { id: "worli", name: "Worli", lat: 19.0159, lng: 72.8183, zone: "South" },
  { id: "mahalaxmi", name: "Mahalaxmi", lat: 18.9830, lng: 72.8200, zone: "South" },
  { id: "byculla", name: "Byculla", lat: 18.9790, lng: 72.8322, zone: "South" },
  { id: "marine-lines", name: "Marine Lines", lat: 18.9445, lng: 72.8233, zone: "South" },
  { id: "churchgate", name: "Churchgate", lat: 18.9322, lng: 72.8264, zone: "South" },
  { id: "fort", name: "Fort", lat: 18.9373, lng: 72.8356, zone: "South" },
  { id: "colaba", name: "Colaba", lat: 18.9067, lng: 72.8147, zone: "South" },
  { id: "cuffe-parade", name: "Cuffe Parade", lat: 18.9146, lng: 72.8107, zone: "South" },
  { id: "malabar-hill", name: "Malabar Hill", lat: 18.9523, lng: 72.7995, zone: "South" },

  // Eastern Suburbs
  { id: "chembur", name: "Chembur", lat: 19.0626, lng: 72.8991, zone: "Eastern" },
  { id: "mankhurd", name: "Mankhurd", lat: 19.0432, lng: 72.9260, zone: "Eastern" },
  { id: "govandi", name: "Govandi", lat: 19.0542, lng: 72.9122, zone: "Eastern" },
  { id: "mulund-west", name: "Mulund West", lat: 19.1722, lng: 72.9447, zone: "Eastern" },
  { id: "mulund-east", name: "Mulund East", lat: 19.1647, lng: 72.9561, zone: "Eastern" },
  { id: "bhandup-west", name: "Bhandup West", lat: 19.1499, lng: 72.9360, zone: "Eastern" },
  { id: "bhandup-east", name: "Bhandup East", lat: 19.1430, lng: 72.9395, zone: "Eastern" },

  // Extended Suburbs
  { id: "dahisar", name: "Dahisar", lat: 19.2595, lng: 72.8626, zone: "Western" },
  { id: "mira-road", name: "Mira Road", lat: 19.2814, lng: 72.8696, zone: "Western" },
  { id: "bhayander", name: "Bhayander", lat: 19.3016, lng: 72.8517, zone: "Western" },
  { id: "thane", name: "Thane", lat: 19.2183, lng: 72.9781, zone: "Eastern" },
  { id: "navi-mumbai", name: "Navi Mumbai", lat: 19.0330, lng: 73.0297, zone: "Eastern" },
];

/**
 * Get areas grouped by zone for better organization
 */
export const getAreasByZone = () => {
  const zones = {
    Western: [],
    Central: [],
    South: [],
    Eastern: [],
  };

  MUMBAI_AREAS.forEach(area => {
    if (zones[area.zone]) {
      zones[area.zone].push(area);
    }
  });

  return zones;
};

/**
 * Calculate distance between user coordinates and area
 * Uses Haversine formula
 */
export const calculateDistance = (userLat, userLng, areaLat, areaLng) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(areaLat - userLat);
  const dLng = toRad(areaLng - userLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLat)) * Math.cos(toRad(areaLat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Find nearest area to user coordinates
 */
export const findNearestArea = (userLat, userLng) => {
  let nearest = null;
  let minDistance = Infinity;

  MUMBAI_AREAS.forEach(area => {
    const distance = calculateDistance(userLat, userLng, area.lat, area.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = area;
    }
  });

  return nearest ? { ...nearest, distance: Math.round(minDistance * 10) / 10 } : null;
};

/**
 * Get all areas with distances from user location
 */
export const getAreasWithDistances = (userLat, userLng) => {
  return MUMBAI_AREAS.map(area => ({
    ...area,
    distance: Math.round(calculateDistance(userLat, userLng, area.lat, area.lng) * 10) / 10
  })).sort((a, b) => a.distance - b.distance);
};
