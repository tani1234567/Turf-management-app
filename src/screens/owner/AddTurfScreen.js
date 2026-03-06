import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  TextInput,
  Button,
  Checkbox,
  Chip,
  IconButton,
  ProgressBar,
  Switch,
  Divider,
  ActivityIndicator,
  Dialog,
  Portal,
  Searchbar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import * as ImagePicker from "expo-image-picker";

import { selectUser } from "../../store/slices/authSlice";
import { selectCompany, updateStats } from "../../store/slices/companySlice";
import { addTurf } from "../../store/slices/ownerSlice";
import { SPORTS, AMENITIES, TIME_SLOTS } from "../../constants/sports";
import { MUMBAI_AREAS } from "../../constants/mumbaiAreas";
import { setDocument, updateDocument, serverTimestamp } from "../../services/firebase/firestore";
import { uploadTurfImages } from "../../services/firebase/turfImages";

const OWNER_COLOR = "#9C27B0";
const TOTAL_STEPS = 5;

const DAYS_OF_WEEK = [
  { id: "monday", name: "Monday", short: "Mon" },
  { id: "tuesday", name: "Tuesday", short: "Tue" },
  { id: "wednesday", name: "Wednesday", short: "Wed" },
  { id: "thursday", name: "Thursday", short: "Thu" },
  { id: "friday", name: "Friday", short: "Fri" },
  { id: "saturday", name: "Saturday", short: "Sat" },
  { id: "sunday", name: "Sunday", short: "Sun" },
];

const DEFAULT_HOURS = {
  isOpen: true,
  openTime: "06:00",
  closeTime: "23:00",
};

const DEFAULT_PRICING = {
  morning: { start: "06:00", end: "10:00", rate: 500 },
  afternoon: { start: "10:00", end: "18:00", rate: 700 },
  evening: { start: "18:00", end: "23:00", rate: 1000 },
};

export default function AddTurfScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);

  // Step 1: Basic Details
  const [turfName, setTurfName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState(null);
  const [additionalImages, setAdditionalImages] = useState([]);

  // Step 2: Location
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [area, setArea] = useState("");
  const [areaSearch, setAreaSearch] = useState("");
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [selectedZone, setSelectedZone] = useState("All");
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [googleMapsLink, setGoogleMapsLink] = useState("");

  // Step 3: Operating Hours
  const [operatingHours, setOperatingHours] = useState(
    DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day.id] = { ...DEFAULT_HOURS };
      return acc;
    }, {})
  );

  // Step 4: Grounds
  const [grounds, setGrounds] = useState([]);

  // Step 5: Pricing
  const [pricingMode, setPricingMode] = useState("slots"); // 'slots' or 'allday'
  const [groundPricing, setGroundPricing] = useState({});

  const progress = currentStep / TOTAL_STEPS;

  const pickImage = async (type) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === "cover" ? [16, 9] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === "cover") {
        setCoverImage(result.assets[0].uri);
      } else {
        if (additionalImages.length < 5) {
          setAdditionalImages([...additionalImages, result.assets[0].uri]);
        }
      }
    }
  };

  const removeAdditionalImage = (index) => {
    setAdditionalImages(additionalImages.filter((_, i) => i !== index));
  };

  const updateOperatingHours = (dayId, field, value) => {
    setOperatingHours({
      ...operatingHours,
      [dayId]: {
        ...operatingHours[dayId],
        [field]: value,
      },
    });
  };

  const copyHoursToAllDays = (sourceDayId) => {
    const sourceHours = operatingHours[sourceDayId];
    const newHours = {};
    DAYS_OF_WEEK.forEach((day) => {
      newHours[day.id] = { ...sourceHours };
    });
    setOperatingHours(newHours);
    Alert.alert("Copied", "Operating hours copied to all days.");
  };

  const addGround = () => {
    const newGround = {
      id: `ground_${Date.now()}`,
      name: `Ground-${grounds.length + 1}`,
      sports: [],
      amenities: [],
    };
    setGrounds([...grounds, newGround]);

    // Initialize pricing for new ground
    setGroundPricing({
      ...groundPricing,
      [newGround.id]: {
        weekday: { ...DEFAULT_PRICING },
        weekend: {
          morning: { ...DEFAULT_PRICING.morning, rate: DEFAULT_PRICING.morning.rate + 200 },
          afternoon: { ...DEFAULT_PRICING.afternoon, rate: DEFAULT_PRICING.afternoon.rate + 200 },
          evening: { ...DEFAULT_PRICING.evening, rate: DEFAULT_PRICING.evening.rate + 300 },
        },
        allDayRate: 5000,
      },
    });
  };

  const updateGround = (groundId, field, value) => {
    setGrounds(
      grounds.map((g) =>
        g.id === groundId ? { ...g, [field]: value } : g
      )
    );
  };

  const removeGround = (groundId) => {
    setGrounds(grounds.filter((g) => g.id !== groundId));
    const newPricing = { ...groundPricing };
    delete newPricing[groundId];
    setGroundPricing(newPricing);
  };

  const toggleSport = (groundId, sportId) => {
    const ground = grounds.find((g) => g.id === groundId);
    const newSports = ground.sports.includes(sportId)
      ? ground.sports.filter((s) => s !== sportId)
      : [...ground.sports, sportId];
    updateGround(groundId, "sports", newSports);
  };

  const toggleAmenity = (groundId, amenityId) => {
    const ground = grounds.find((g) => g.id === groundId);
    const newAmenities = ground.amenities.includes(amenityId)
      ? ground.amenities.filter((a) => a !== amenityId)
      : [...ground.amenities, amenityId];
    updateGround(groundId, "amenities", newAmenities);
  };

  const updatePricing = (groundId, dayType, slot, field, value) => {
    setGroundPricing({
      ...groundPricing,
      [groundId]: {
        ...groundPricing[groundId],
        [dayType]: {
          ...groundPricing[groundId]?.[dayType],
          [slot]: {
            ...groundPricing[groundId]?.[dayType]?.[slot],
            [field]: value,
          },
        },
      },
    });
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!turfName.trim()) {
          Alert.alert("Required", "Please enter a turf name.");
          return false;
        }
        return true;
      case 2:
        if (!city.trim()) {
          Alert.alert("Required", "Please enter a city.");
          return false;
        }
        if (!area.trim()) {
          Alert.alert("Missing Info", "Area is required");
          return false;
        }
        if (!coordinates.lat || !coordinates.lng) {
          Alert.alert("Missing Info", "Coordinates are required. Please enter Google Maps link or coordinates manually.");
          return false;
        }
        return true;
      case 3:
        return true;
      case 4:
        if (grounds.length === 0) {
          Alert.alert("Required", "Please add at least one ground.");
          return false;
        }
        for (const ground of grounds) {
          if (ground.sports.length === 0) {
            Alert.alert("Required", `Please select at least one sport for ${ground.name}.`);
            return false;
          }
        }
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      navigation.goBack();
    }
  };

  const extractCoordinatesFromMapsLink = (link) => {
    if (!link) return null;

    // Pattern 1: https://maps.app.goo.gl/... (shortened link - can't extract)
    if (link.includes('maps.app.goo.gl')) {
      // TODO: Make API call to expand shortened URL
      return null;
    }

    // Pattern 2: https://www.google.com/maps?q=19.1234,72.5678
    const qPattern = /[?&]q=([-\d.]+),([-\d.]+)/;
    const qMatch = link.match(qPattern);
    if (qMatch) {
      return {
        lat: parseFloat(qMatch[1]),
        lng: parseFloat(qMatch[2])
      };
    }

    // Pattern 3: https://www.google.com/maps/@19.1234,72.5678,15z
    const atPattern = /@([-\d.]+),([-\d.]+)/;
    const atMatch = link.match(atPattern);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2])
      };
    }

    // Pattern 4: https://maps.google.com/?q=19.1234,72.5678
    const coordPattern = /([-\d.]+),([-\d.]+)/;
    const coordMatch = link.match(coordPattern);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      // Validate it's in Mumbai range
      if (lat >= 18.8 && lat <= 19.5 && lng >= 72.7 && lng <= 73.1) {
        return { lat, lng };
      }
    }

    return null;
  };

  const handleGoogleMapsLinkChange = (link) => {
    setGoogleMapsLink(link);

    // Try to extract coordinates
    const coords = extractCoordinatesFromMapsLink(link);
    if (coords) {
      setCoordinates(coords);
      Alert.alert("Success", "Coordinates extracted from Google Maps link!");
    } else if (link.includes('maps.app.goo.gl')) {
      Alert.alert(
        "Shortened Link Detected",
        "Please open the link and copy the full URL with coordinates, or enter coordinates manually below."
      );
    }
  };

  const generateTurfId = () => {
    return `turf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateQRCodeData = (turfId) => {
    return {
      global: `https://turfbooking.app/book`,
      turf: `https://turfbooking.app/book/${turfId}`,
    };
  };

  const handleSubmit = async () => {
    // Validate required data
    const companyId = company?.id || company?.companyId;
    if (!companyId) {
      Alert.alert("Error", "Company information is missing. Please try again.");
      return;
    }

    setLoading(true);

    try {
      const turfId = generateTurfId();
      const qrCodes = generateQRCodeData(turfId);
      const uploadedMedia = await uploadTurfImages({
        companyId,
        turfId,
        coverImage,
        images: additionalImages,
      });

      // Prepare ground documents
      const groundsData = grounds.map((ground, index) => ({
        groundId: ground.id,
        name: ground.name || `Ground-${index + 1}`,
        sports: ground.sports || [],
        amenities: ground.amenities || [],
        pricing: groundPricing[ground.id] || {},
        isActive: true,
        order: index,
      }));

      // Create turf document
      const turfData = {
        turfId,
        companyId,
        name: turfName.trim(),
        description: description.trim() || null,
        coverImage: uploadedMedia.coverImage || null,
        images: uploadedMedia.images || [],
        location: {
          area: area.trim(),
          address: address.trim() || null,
          city: city.trim(),
          state: state.trim() || null,
          pincode: pincode.trim() || null,
          coordinates: {
            lat: coordinates?.lat || null,
            lng: coordinates?.lng || null,
          },
          googleMapsLink: googleMapsLink.trim() || null,
        },
        operatingHours,
        grounds: groundsData,
        totalGrounds: grounds.length,
        managerIds: [],
        caretakerIds: [],
        isActive: true,
        qrCodes,
        stats: {
          totalBookings: 0,
          monthlyRevenue: 0,
          todayBookings: 0,
        },
        createdAt: serverTimestamp(),
        createdBy: user?.userId || null,
        updatedAt: serverTimestamp(),
      };

      // Save to Firestore
      await setDocument("turfs", turfId, turfData);

      // Update company stats
      const currentTotalTurfs = company?.stats?.totalTurfs || 0;
      const currentTotalGrounds = company?.stats?.totalGrounds || 0;

      await updateDocument("companies", companyId, {
        "stats.totalTurfs": currentTotalTurfs + 1,
        "stats.totalGrounds": currentTotalGrounds + grounds.length,
      });

      // Update Redux
      dispatch(addTurf(turfData));
      dispatch(updateStats({
        totalTurfs: currentTotalTurfs + 1,
        totalGrounds: currentTotalGrounds + grounds.length,
      }));

      Alert.alert(
        "Success!",
        `${turfName} has been created with ${grounds.length} ground(s).`,
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error("Error creating turf:", error);
      Alert.alert("Error", "Failed to create turf. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <ProgressBar progress={progress} color={OWNER_COLOR} style={styles.progressBar} />
      <View style={styles.stepLabels}>
        {["Details", "Location", "Hours", "Grounds", "Pricing"].map((label, index) => (
          <Text
            key={label}
            variant="bodySmall"
            style={[
              styles.stepLabel,
              currentStep === index + 1 && styles.stepLabelActive,
              currentStep > index + 1 && styles.stepLabelCompleted,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Basic Details
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Enter your turf's basic information
      </Text>

      <TextInput
        mode="outlined"
        label="Turf Name *"
        placeholder="e.g., Green Field Sports Arena"
        value={turfName}
        onChangeText={setTurfName}
        style={styles.input}
      />

      <TextInput
        mode="outlined"
        label="Description"
        placeholder="Describe your turf facilities..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        style={styles.input}
      />

      <Text variant="titleSmall" style={styles.sectionLabel}>
        Cover Image
      </Text>
      <TouchableOpacity
        style={styles.imagePickerLarge}
        onPress={() => pickImage("cover")}
      >
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImagePreview} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="image-plus" size={48} color="#999" />
            <Text variant="bodyMedium" style={styles.imagePlaceholderText}>
              Tap to add cover image
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Text variant="titleSmall" style={styles.sectionLabel}>
        Additional Images ({additionalImages.length}/5)
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.additionalImagesRow}>
          {additionalImages.map((uri, index) => (
            <View key={index} style={styles.additionalImageContainer}>
              <Image source={{ uri }} style={styles.additionalImage} />
              <IconButton
                icon="close-circle"
                size={20}
                style={styles.removeImageButton}
                iconColor="#F44336"
                onPress={() => removeAdditionalImage(index)}
              />
            </View>
          ))}
          {additionalImages.length < 5 && (
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={() => pickImage("additional")}
            >
              <MaterialCommunityIcons name="plus" size={32} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Location
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Where is your turf located?
      </Text>

      <TextInput
        mode="outlined"
        label="Address Line"
        placeholder="Street address, building name..."
        value={address}
        onChangeText={setAddress}
        style={styles.input}
      />

      <TextInput
        mode="outlined"
        label="City *"
        placeholder="e.g., Mumbai"
        value={city}
        onChangeText={setCity}
        style={styles.input}
      />

      <View style={styles.row}>
        <TextInput
          mode="outlined"
          label="State"
          placeholder="e.g., Maharashtra"
          value={state}
          onChangeText={setState}
          style={[styles.input, styles.halfInput]}
        />
        <TextInput
          mode="outlined"
          label="Pincode"
          placeholder="e.g., 400001"
          value={pincode}
          onChangeText={setPincode}
          keyboardType="numeric"
          maxLength={6}
          style={[styles.input, styles.halfInput]}
        />
      </View>

      {/* Area Selection */}
      <Text variant="titleSmall" style={styles.inputLabel}>
        Area *
      </Text>
      <TouchableOpacity
        style={styles.areaSelector}
        onPress={() => setAreaModalVisible(true)}
      >
        <Text style={area ? styles.areaSelectorText : styles.areaSelectorPlaceholder}>
          {area || "Select Mumbai area"}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

      <TextInput
        mode="outlined"
        label="Google Maps Link"
        placeholder="Paste Google Maps URL"
        value={googleMapsLink}
        onChangeText={handleGoogleMapsLinkChange}
        style={styles.input}
        left={<TextInput.Icon icon="google-maps" />}
      />

      {/* Coordinates Display/Input */}
      <Text variant="titleSmall" style={styles.inputLabel}>
        Coordinates {coordinates.lat && coordinates.lng ? "✓" : "*"}
      </Text>
      {coordinates.lat && coordinates.lng ? (
        <View style={styles.coordinatesDisplay}>
          <MaterialCommunityIcons name="map-marker-check" size={20} color="#4CAF50" />
          <Text style={styles.coordinatesText}>
            {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
          </Text>
          <TouchableOpacity onPress={() => setCoordinates({ lat: null, lng: null })}>
            <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      ) : (
        <Surface style={styles.coordinatesInputContainer} elevation={0}>
          <Text variant="bodySmall" style={styles.coordinatesHint}>
            Coordinates will be extracted from Google Maps link above
          </Text>
          <Text variant="bodySmall" style={styles.coordinatesHint}>
            Or enter manually:
          </Text>
          <View style={styles.manualCoordinatesRow}>
            <TextInput
              label="Latitude"
              value={coordinates.lat?.toString() || ""}
              onChangeText={(text) => setCoordinates(prev => ({
                ...prev,
                lat: parseFloat(text) || null
              }))}
              keyboardType="decimal-pad"
              style={styles.coordinateInput}
              dense
            />
            <TextInput
              label="Longitude"
              value={coordinates.lng?.toString() || ""}
              onChangeText={(text) => setCoordinates(prev => ({
                ...prev,
                lng: parseFloat(text) || null
              }))}
              keyboardType="decimal-pad"
              style={styles.coordinateInput}
              dense
            />
          </View>
        </Surface>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Operating Hours
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Set when your turf is open for bookings
      </Text>

      {DAYS_OF_WEEK.map((day) => (
        <Surface key={day.id} style={styles.dayCard} elevation={1}>
          <View style={styles.dayHeader}>
            <View style={styles.dayInfo}>
              <Switch
                value={operatingHours[day.id]?.isOpen}
                onValueChange={(value) => updateOperatingHours(day.id, "isOpen", value)}
                color={OWNER_COLOR}
              />
              <Text variant="titleSmall" style={styles.dayName}>
                {day.name}
              </Text>
            </View>
            {operatingHours[day.id]?.isOpen && (
              <TouchableOpacity onPress={() => copyHoursToAllDays(day.id)}>
                <Text variant="bodySmall" style={styles.copyLink}>
                  Copy to all
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {operatingHours[day.id]?.isOpen && (
            <View style={styles.timeRow}>
              <View style={styles.timeInput}>
                <Text variant="bodySmall" style={styles.timeLabel}>Open</Text>
                <TextInput
                  mode="outlined"
                  value={operatingHours[day.id]?.openTime}
                  onChangeText={(v) => updateOperatingHours(day.id, "openTime", v)}
                  placeholder="06:00"
                  dense
                  style={styles.timeField}
                />
              </View>
              <Text style={styles.timeSeparator}>to</Text>
              <View style={styles.timeInput}>
                <Text variant="bodySmall" style={styles.timeLabel}>Close</Text>
                <TextInput
                  mode="outlined"
                  value={operatingHours[day.id]?.closeTime}
                  onChangeText={(v) => updateOperatingHours(day.id, "closeTime", v)}
                  placeholder="23:00"
                  dense
                  style={styles.timeField}
                />
              </View>
            </View>
          )}

          {!operatingHours[day.id]?.isOpen && (
            <Text variant="bodySmall" style={styles.closedText}>
              Closed
            </Text>
          )}
        </Surface>
      ))}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Grounds Setup
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Add the grounds available at your turf
      </Text>

      {grounds.map((ground, index) => (
        <Surface key={ground.id} style={styles.groundCard} elevation={2}>
          <View style={styles.groundHeader}>
            <TextInput
              mode="outlined"
              label="Ground Name"
              value={ground.name}
              onChangeText={(v) => updateGround(ground.id, "name", v)}
              style={styles.groundNameInput}
              dense
            />
            <IconButton
              icon="delete"
              size={24}
              iconColor="#F44336"
              onPress={() => removeGround(ground.id)}
            />
          </View>

          <Text variant="titleSmall" style={styles.groundSectionLabel}>
            Sports Available *
          </Text>
          <View style={styles.chipContainer}>
            {SPORTS.map((sport) => (
              <Chip
                key={sport.id}
                mode={ground.sports.includes(sport.id) ? "flat" : "outlined"}
                selected={ground.sports.includes(sport.id)}
                onPress={() => toggleSport(ground.id, sport.id)}
                style={styles.sportChip}
                icon={() => (
                  <MaterialCommunityIcons
                    name={sport.icon}
                    size={16}
                    color={ground.sports.includes(sport.id) ? "#fff" : sport.color}
                  />
                )}
                selectedColor="#fff"
                showSelectedOverlay
              >
                {sport.name}
              </Chip>
            ))}
          </View>

          <Text variant="titleSmall" style={styles.groundSectionLabel}>
            Amenities
          </Text>
          <View style={styles.chipContainer}>
            {AMENITIES.map((amenity) => (
              <Chip
                key={amenity.id}
                mode={ground.amenities.includes(amenity.id) ? "flat" : "outlined"}
                selected={ground.amenities.includes(amenity.id)}
                onPress={() => toggleAmenity(ground.id, amenity.id)}
                style={styles.amenityChip}
                icon={() => (
                  <MaterialCommunityIcons
                    name={amenity.icon}
                    size={16}
                    color={ground.amenities.includes(amenity.id) ? "#fff" : "#666"}
                  />
                )}
              >
                {amenity.name}
              </Chip>
            ))}
          </View>
        </Surface>
      ))}

      <Button
        mode="outlined"
        icon="plus"
        onPress={addGround}
        style={styles.addGroundButton}
      >
        Add Ground
      </Button>

      {grounds.length === 0 && (
        <View style={styles.emptyGrounds}>
          <MaterialCommunityIcons name="soccer-field" size={48} color="#ccc" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Add at least one ground to continue
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleLarge" style={styles.stepTitle}>
        Pricing
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Set hourly rates for each ground
      </Text>

      <View style={styles.pricingModeToggle}>
        <Chip
          mode={pricingMode === "slots" ? "flat" : "outlined"}
          selected={pricingMode === "slots"}
          onPress={() => setPricingMode("slots")}
          style={styles.pricingModeChip}
        >
          Time Slots
        </Chip>
        <Chip
          mode={pricingMode === "allday" ? "flat" : "outlined"}
          selected={pricingMode === "allday"}
          onPress={() => setPricingMode("allday")}
          style={styles.pricingModeChip}
        >
          All Day Rate
        </Chip>
      </View>

      {grounds.map((ground) => (
        <Surface key={ground.id} style={styles.pricingCard} elevation={1}>
          <Text variant="titleMedium" style={styles.pricingGroundName}>
            {ground.name}
          </Text>

          {pricingMode === "slots" ? (
            <>
              {["weekday", "weekend"].map((dayType) => (
                <View key={dayType} style={styles.dayTypePricing}>
                  <Text variant="titleSmall" style={styles.dayTypeLabel}>
                    {dayType === "weekday" ? "Weekday" : "Weekend"} Pricing
                  </Text>

                  {["morning", "afternoon", "evening"].map((slot) => (
                    <View key={slot} style={styles.slotRow}>
                      <Text variant="bodyMedium" style={styles.slotName}>
                        {slot.charAt(0).toUpperCase() + slot.slice(1)}
                      </Text>
                      <View style={styles.slotInputs}>
                        <TextInput
                          mode="outlined"
                          label="Rate/hr"
                          value={String(groundPricing[ground.id]?.[dayType]?.[slot]?.rate || "")}
                          onChangeText={(v) => updatePricing(ground.id, dayType, slot, "rate", parseInt(v) || 0)}
                          keyboardType="numeric"
                          dense
                          style={styles.rateInput}
                          left={<TextInput.Affix text="₹" />}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.allDayPricing}>
              <Text variant="bodyMedium">Full Day Rate</Text>
              <TextInput
                mode="outlined"
                label="Rate per day"
                value={String(groundPricing[ground.id]?.allDayRate || "")}
                onChangeText={(v) =>
                  setGroundPricing({
                    ...groundPricing,
                    [ground.id]: {
                      ...groundPricing[ground.id],
                      allDayRate: parseInt(v) || 0,
                    },
                  })
                }
                keyboardType="numeric"
                style={styles.allDayInput}
                left={<TextInput.Affix text="₹" />}
              />
            </View>
          )}
        </Surface>
      ))}

      {/* Price Preview */}
      <Surface style={styles.pricePreview} elevation={1}>
        <Text variant="titleSmall" style={styles.previewTitle}>
          Price Preview
        </Text>
        {grounds.length > 0 && groundPricing[grounds[0]?.id] && (
          <View style={styles.previewContent}>
            <View style={styles.previewRow}>
              <Text variant="bodySmall">Weekday Morning (1hr)</Text>
              <Text variant="bodyMedium" style={styles.previewPrice}>
                ₹{groundPricing[grounds[0].id]?.weekday?.morning?.rate || 0}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text variant="bodySmall">Weekend Evening (1hr)</Text>
              <Text variant="bodyMedium" style={styles.previewPrice}>
                ₹{groundPricing[grounds[0].id]?.weekend?.evening?.rate || 0}
              </Text>
            </View>
          </View>
        )}
      </Surface>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={handleBack} />
        <View style={styles.headerContent}>
          <Text variant="titleLarge" style={styles.headerTitle}>
            Add New Turf
          </Text>
          <Text variant="bodySmall" style={styles.headerSubtitle}>
            Step {currentStep} of {TOTAL_STEPS}
          </Text>
        </View>
      </View>

      {/* Area Selection Modal */}
      <Portal>
        <Dialog
          visible={areaModalVisible}
          onDismiss={() => setAreaModalVisible(false)}
          style={styles.areaDialog}
        >
          <Dialog.Title>Select Area</Dialog.Title>

          {/* Search */}
          <View style={styles.areaSearchWrapper}>
            <Searchbar
              placeholder="Search areas..."
              value={areaSearch}
              onChangeText={setAreaSearch}
              style={styles.areaSearchbar}
            />
          </View>

          {/* Zone Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.zoneFilterContainer}
            contentContainerStyle={styles.zoneFilterContent}
          >
            {["All", "Western", "Central", "South", "Eastern"].map((zone) => (
              <Chip
                key={zone}
                selected={selectedZone === zone}
                onPress={() => setSelectedZone(zone)}
                style={[
                  styles.zoneChip,
                  selectedZone === zone && styles.selectedZoneChip,
                ]}
              >
                {zone}
              </Chip>
            ))}
          </ScrollView>

          {/* Area List */}
          <Dialog.ScrollArea style={styles.areaScrollArea}>
            <ScrollView>
              {MUMBAI_AREAS
                .filter(a => {
                  if (selectedZone !== "All" && a.zone !== selectedZone) return false;
                  if (areaSearch && !a.name.toLowerCase().includes(areaSearch.toLowerCase())) return false;
                  return true;
                })
                .map((areaItem) => (
                  <TouchableOpacity
                    key={areaItem.id}
                    style={styles.areaItem}
                    onPress={() => {
                      setArea(areaItem.name);
                      setAreaModalVisible(false);
                      setAreaSearch("");
                      // Auto-fill coordinates if not set
                      if (!coordinates.lat || !coordinates.lng) {
                        setCoordinates({ lat: areaItem.lat, lng: areaItem.lng });
                        Alert.alert(
                          "Coordinates Set",
                          "Area center coordinates have been set. You can update them manually if needed."
                        );
                      }
                    }}
                  >
                    <MaterialCommunityIcons
                      name={area === areaItem.name ? "checkbox-marked-circle" : "map-marker-outline"}
                      size={20}
                      color={area === areaItem.name ? "#4CAF50" : "#666"}
                    />
                    <View style={styles.areaItemContent}>
                      <Text style={[
                        styles.areaItemText,
                        area === areaItem.name && styles.areaItemActive
                      ]}>
                        {areaItem.name}
                      </Text>
                      <Text style={styles.areaItemZone}>{areaItem.zone}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </Dialog.ScrollArea>

          <Dialog.Actions>
            <Button onPress={() => setAreaModalVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {renderStepIndicator()}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        {currentStep > 1 && (
          <Button
            mode="outlined"
            onPress={handleBack}
            style={styles.backButton}
          >
            Back
          </Button>
        )}
        <Button
          mode="contained"
          onPress={handleNext}
          loading={loading}
          disabled={loading}
          style={styles.nextButton}
          buttonColor={OWNER_COLOR}
        >
          {currentStep === TOTAL_STEPS ? "Create Turf" : "Next"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#666",
  },
  stepIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  stepLabel: {
    color: "#999",
    fontSize: 11,
  },
  stepLabelActive: {
    color: OWNER_COLOR,
    fontWeight: "bold",
  },
  stepLabelCompleted: {
    color: "#4CAF50",
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  stepSubtitle: {
    color: "#666",
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  sectionLabel: {
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 8,
  },
  imagePickerLarge: {
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  coverImagePreview: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#999",
    marginTop: 8,
  },
  additionalImagesRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  additionalImageContainer: {
    position: "relative",
  },
  additionalImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  mapPlaceholder: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  mapPlaceholderText: {
    color: "#999",
    marginTop: 8,
  },
  mapSubtext: {
    color: "#ccc",
    marginTop: 4,
  },
  dayCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayName: {
    marginLeft: 8,
    fontWeight: "600",
  },
  copyLink: {
    color: OWNER_COLOR,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    color: "#666",
    marginBottom: 4,
  },
  timeField: {
    backgroundColor: "#fff",
  },
  timeSeparator: {
    marginHorizontal: 12,
    color: "#666",
  },
  closedText: {
    color: "#F44336",
    marginTop: 8,
    marginLeft: 48,
  },
  groundCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  groundHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  groundNameInput: {
    flex: 1,
    backgroundColor: "#fff",
  },
  groundSectionLabel: {
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sportChip: {
    marginBottom: 4,
  },
  amenityChip: {
    marginBottom: 4,
  },
  addGroundButton: {
    marginTop: 8,
    borderColor: OWNER_COLOR,
  },
  emptyGrounds: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    color: "#999",
    marginTop: 12,
  },
  pricingModeToggle: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  pricingModeChip: {
    flex: 1,
  },
  pricingCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  pricingGroundName: {
    fontWeight: "bold",
    marginBottom: 12,
  },
  dayTypePricing: {
    marginBottom: 16,
  },
  dayTypeLabel: {
    fontWeight: "600",
    color: OWNER_COLOR,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  slotName: {
    flex: 1,
  },
  slotInputs: {
    flexDirection: "row",
    alignItems: "center",
  },
  rateInput: {
    width: 120,
    backgroundColor: "#fff",
  },
  allDayPricing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  allDayInput: {
    width: 150,
    backgroundColor: "#fff",
  },
  pricePreview: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F3E5F5",
  },
  previewTitle: {
    fontWeight: "bold",
    marginBottom: 12,
  },
  previewContent: {},
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  previewPrice: {
    fontWeight: "bold",
    color: OWNER_COLOR,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  inputLabel: {
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 8,
  },
  areaSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F0FF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  areaSelectorText: {
    fontSize: 15,
    color: "#333",
  },
  areaSelectorPlaceholder: {
    fontSize: 15,
    color: "#999",
  },
  coordinatesDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  coordinatesText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontFamily: "Ubuntu-Medium",
  },
  coordinatesInputContainer: {
    backgroundColor: "#FFF8E1",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  coordinatesHint: {
    color: "#666",
    marginBottom: 8,
  },
  manualCoordinatesRow: {
    flexDirection: "row",
    gap: 12,
  },
  coordinateInput: {
    flex: 1,
    backgroundColor: "#fff",
  },
  areaDialog: {
    maxHeight: "80%",
  },
  areaSearchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  areaSearchbar: {
    backgroundColor: "#F5F0FF",
    elevation: 0,
  },
  zoneFilterContainer: {
    marginBottom: 8,
  },
  zoneFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  zoneChip: {
    backgroundColor: "#F5F0FF",
  },
  selectedZoneChip: {
    backgroundColor: "#4CAF50",
  },
  areaScrollArea: {
    maxHeight: 300,
    paddingHorizontal: 0,
  },
  areaItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  areaItemContent: {
    flex: 1,
  },
  areaItemText: {
    fontSize: 15,
    color: "#333",
  },
  areaItemActive: {
    color: "#4CAF50",
    fontFamily: "Ubuntu-Medium",
  },
  areaItemZone: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
});
