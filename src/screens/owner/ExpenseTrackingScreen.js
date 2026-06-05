import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Image,
  Modal as RNModal,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  IconButton,
  ActivityIndicator,
  FAB,
  Menu,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path, G, Circle as SvgCircle, Text as SvgText } from "react-native-svg";
import { selectUser } from "../../store/slices/authSlice";
import {
  selectCompany,
} from "../../store/slices/companySlice";
import {
  selectTurfs,
  setTurfs,
} from "../../store/slices/ownerSlice";
import {
  addExpense,
  uploadReceiptImages,
  getExpensesForCompany,
  updateExpense,
  deleteExpense,
  calculateExpenseSummary,
} from "../../services/firebase/expenses";
import {
  getCategoriesForRole,
  getCategoryLabel,
  getCategoryIcon,
  formatSubcategory,
} from "../../constants/expenseCategories";
import { queryDocuments } from "../../services/firebase/firestore";
import { usePermissions } from "../../hooks";

const OWNER_COLOR = "#9C27B0";

const PIE_COLORS = [
  "#9C27B0", "#2196F3", "#4CAF50", "#FF9800", "#F44336",
  "#00BCD4", "#795548", "#607D8B", "#E91E63",
];

const getTodayString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function OwnerExpenseTrackingScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const reduxTurfs = useSelector(selectTurfs);
  const permissions = usePermissions();
  const categories = getCategoriesForRole("owner");

  const hasOperationalPermissions =
    permissions?.canManageBookings || permissions?.canManageExpenses || user?.role === "owner";

  // Turf data
  const [localTurfs, setLocalTurfs] = useState([]);
  const turfs = reduxTurfs && reduxTurfs.length > 0 ? reduxTurfs : localTurfs;

  // Filter state
  const [selectedTurfId, setSelectedTurfId] = useState(null); // null = all turfs
  const [turfMenuVisible, setTurfMenuVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState(null);

  // List state
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, byCategory: {}, byRole: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state (only if operational permissions)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [formTurfId, setFormTurfId] = useState(null);
  const [formTurfMenuVisible, setFormTurfMenuVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getTodayString());
  const [receiptImages, setReceiptImages] = useState([]);

  // Fetch turfs if needed
  useEffect(() => {
    const fetchTurfs = async () => {
      if (reduxTurfs && reduxTurfs.length > 0) return;
      const companyId = company?.id || company?.companyId;
      if (!companyId) return;
      try {
        const fetched = await queryDocuments("turfs", [
          { field: "companyId", operator: "==", value: companyId },
        ]);
        setLocalTurfs(fetched);
        if (fetched.length > 0) {
          dispatch(setTurfs(fetched));
        }
      } catch (error) {
        console.error("Error fetching turfs:", error);
      }
    };
    fetchTurfs();
  }, [company, reduxTurfs]);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const filters = {};
      if (selectedTurfId) {
        filters.turfId = selectedTurfId;
      }
      if (filterCategory) {
        filters.category = filterCategory;
      }
      const data = await getExpensesForCompany(companyId, filters);
      setExpenses(data);
      const expenseSummary = calculateExpenseSummary(data);
      setSummary(expenseSummary);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      Alert.alert("Error", "Failed to load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [company, selectedTurfId, filterCategory]);

  useEffect(() => {
    setLoading(true);
    fetchExpenses();
  }, [fetchExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExpenses();
    setRefreshing(false);
  }, [fetchExpenses]);

  // Form helpers
  const resetForm = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setFormTurfId(turfs.length > 0 ? turfs[0].id : null);
    setAmount("");
    setDescription("");
    setDate(getTodayString());
    setReceiptImages([]);
    setEditingExpense(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setSelectedCategory(expense.category || null);
    setSelectedSubcategory(expense.subcategory || null);
    setFormTurfId(expense.turfId || null);
    setAmount(expense.amount ? String(expense.amount) : "");
    setDescription(expense.description || "");
    setDate(expense.date || getTodayString());
    setReceiptImages(expense.receiptImages || []);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const getSubcategories = () => {
    if (!selectedCategory) return [];
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat?.subcategories || [];
  };

  // Image picker
  const pickImage = async () => {
    if (receiptImages.length >= 3) {
      Alert.alert("Limit Reached", "You can upload up to 3 receipt images.");
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setReceiptImages([...receiptImages, result.assets[0].uri]);
    }
  };

  const removeImage = (index) => {
    setReceiptImages(receiptImages.filter((_, i) => i !== index));
  };

  // Validate
  const validateForm = () => {
    if (!formTurfId) {
      Alert.alert("Required", "Please select a turf.");
      return false;
    }
    if (!selectedCategory) {
      Alert.alert("Required", "Please select a category.");
      return false;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Required", "Please enter a valid amount.");
      return false;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert("Invalid Date", "Please enter date in YYYY-MM-DD format.");
      return false;
    }
    return true;
  };

  // Submit
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      const companyId = company?.id || company?.companyId;

      if (editingExpense) {
        const updates = {
          turfId: formTurfId,
          category: selectedCategory,
          subcategory: selectedSubcategory || null,
          categoryLabel: getCategoryLabel(selectedCategory, "owner"),
          amount: parseFloat(amount),
          description: description.trim(),
          date,
        };

        const newLocalImages = receiptImages.filter((uri) => !uri.startsWith("http"));
        if (newLocalImages.length > 0) {
          const uploadedUrls = await uploadReceiptImages(editingExpense.id, newLocalImages);
          const existingUrls = receiptImages.filter((uri) => uri.startsWith("http"));
          const allUrls = [...existingUrls, ...uploadedUrls];
          updates.receiptImages = allUrls;
          updates.receiptImage = allUrls[0] || null;
        }

        await updateExpense(editingExpense.id, updates);
        Alert.alert("Success", "Expense updated successfully.");
      } else {
        const expenseData = {
          companyId: companyId || null,
          turfId: formTurfId,
          category: selectedCategory,
          subcategory: selectedSubcategory || null,
          categoryLabel: getCategoryLabel(selectedCategory, "owner"),
          amount: parseFloat(amount),
          description: description.trim(),
          date,
          receiptImages: [],
          receiptImage: null,
        };

        const result = await addExpense(expenseData, user);

        if (receiptImages.length > 0 && result.expenseId) {
          const urls = await uploadReceiptImages(result.expenseId, receiptImages);
          await updateExpense(result.expenseId, {
            receiptImages: urls,
            receiptImage: urls[0] || null,
          });
        }

        Alert.alert("Success", "Expense added successfully.");
      }

      closeModal();
      await fetchExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      Alert.alert("Error", "Failed to save expense. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete — owner can delete any expense; others only their own
  const handleDelete = (expense) => {
    const userId = user?.userId || user?.uid;
    const isOwner = user?.role === "owner";
    if (!isOwner && expense.addedBy !== userId) {
      Alert.alert("Not Allowed", "You can only delete expenses you added.");
      return;
    }

    const deletedByOther = isOwner && expense.addedBy !== userId;

    Alert.alert(
      "Delete Expense",
      deletedByOther
        ? `Delete this ₹${expense.amount} expense added by ${expense.addedByName || "a team member"}? This action will be logged.`
        : `Delete this expense of ₹${expense.amount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteExpense(expense.id);
              if (deletedByOther) {
                const { addDocument } = require("../../services/firebase/firestore");
                await addDocument("expense_deletion_logs", {
                  expenseId: expense.id,
                  turfId: expense.turfId || null,
                  companyId: expense.companyId || company?.id || company?.companyId,
                  amount: expense.amount,
                  category: expense.category,
                  originalAddedBy: expense.addedBy,
                  originalAddedByName: expense.addedByName || null,
                  deletedBy: userId,
                  deletedByName: user?.name || null,
                  deletedAt: new Date().toISOString(),
                });
              }
              await fetchExpenses();
            } catch (error) {
              Alert.alert("Error", "Failed to delete expense.");
            }
          },
        },
      ]
    );
  };

  // Export CSV
  const handleExport = async () => {
    if (expenses.length === 0) {
      Alert.alert("No Data", "No expenses to export.");
      return;
    }

    const turfNameMap = {};
    turfs.forEach((t) => {
      turfNameMap[t.id] = t.name;
    });

    let csv = "Date,Turf,Category,Subcategory,Amount,Description,Added By,Role\n";
    expenses.forEach((e) => {
      csv += `${e.date || ""},${turfNameMap[e.turfId] || "Unknown"},${getCategoryLabel(e.category, "owner")},${formatSubcategory(e.subcategory) || ""},${e.amount || 0},"${(e.description || "").replace(/"/g, '""')}",${e.addedByName || ""},${e.addedByRole || ""}\n`;
    });
    csv += `\nTotal,,,,,${summary.total || 0},,\n`;

    try {
      await Share.share({
        message: csv,
        title: `${company?.name || "Company"} Expenses Export`,
      });
    } catch (error) {
      console.error("Error exporting:", error);
    }
  };

  // Format date
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const [yyyy, mm, dd] = dateStr.split("-");
      const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getTurfName = (turfId) => {
    const turf = turfs.find((t) => t.id === turfId);
    return turf?.name || "Unknown Turf";
  };

  const isOwnExpense = (expense) => {
    const userId = user?.userId || user?.uid;
    return expense.addedBy === userId;
  };

  // Pie chart for category breakdown
  const renderPieChart = () => {
    const entries = Object.entries(summary.byCategory || {});
    if (entries.length === 0) return null;

    const total = summary.total || 1;
    const size = 160;
    const center = size / 2;
    const radius = 60;

    let startAngle = 0;
    const slices = entries.map(([catId, catAmount], index) => {
      const percentage = catAmount / total;
      const angle = percentage * 360;
      const endAngle = startAngle + angle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      const pathData =
        entries.length === 1
          ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
          : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const color = PIE_COLORS[index % PIE_COLORS.length];
      startAngle = endAngle;

      return { catId, catAmount, percentage, pathData, color };
    });

    return (
      <Surface style={styles.pieCard} elevation={1}>
        <Text variant="titleSmall" style={styles.pieTitle}>
          Expense Distribution
        </Text>
        <View style={styles.pieContainer}>
          <Svg width={size} height={size}>
            {slices.map((slice, i) => (
              <Path key={i} d={slice.pathData} fill={slice.color} />
            ))}
            <SvgCircle cx={center} cy={center} r={40} fill="#fff" />
            <SvgText
              x={center}
              y={center - 4}
              textAnchor="middle"
              fontSize="10"
              fill="#888"
            >
              Total
            </SvgText>
            <SvgText
              x={center}
              y={center + 10}
              textAnchor="middle"
              fontSize="13"
              fontWeight="bold"
              fill="#333"
            >
              {total >= 100000 ? `₹${(total / 100000).toFixed(1)}L` : total >= 1000 ? `₹${(total / 1000).toFixed(1)}K` : `₹${total}`}
            </SvgText>
          </Svg>
          <View style={styles.pieLegend}>
            {slices.map((slice, i) => (
              <View key={i} style={styles.pieLegendItem}>
                <View
                  style={[styles.pieLegendDot, { backgroundColor: slice.color }]}
                />
                <Text variant="bodySmall" style={styles.pieLegendLabel} numberOfLines={1}>
                  {getCategoryLabel(slice.catId, "owner")}
                </Text>
                <Text variant="bodySmall" style={styles.pieLegendValue}>
                  {Math.round(slice.percentage * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Surface>
    );
  };

  // Render summary + filters header
  const renderHeader = () => (
    <View>
      {/* Summary card */}
      <Surface style={styles.summaryCard} elevation={1}>
        <View style={styles.summaryContent}>
          <View style={styles.summaryIconContainer}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={32}
              color={OWNER_COLOR}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text variant="bodySmall" style={styles.summaryLabel}>
              Total Company Expenses
            </Text>
            <Text variant="headlineMedium" style={styles.summaryAmount}>
              Rs.{summary.total || 0}
            </Text>
            <Text variant="bodySmall" style={styles.summaryCount}>
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""} across{" "}
              {turfs.length} turf{turfs.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <IconButton
            icon="download"
            size={24}
            iconColor={OWNER_COLOR}
            onPress={handleExport}
          />
        </View>
      </Surface>

      {/* Role breakdown */}
      {(summary.byRole?.caretaker > 0 ||
        summary.byRole?.manager > 0 ||
        summary.byRole?.owner > 0) && (
        <Surface style={styles.roleCard} elevation={1}>
          <Text variant="titleSmall" style={styles.roleTitle}>
            By Role
          </Text>
          <View style={styles.roleRow}>
            {[
              { role: "caretaker", label: "Caretakers", color: "#FF9800", amount: summary.byRole?.caretaker || 0 },
              { role: "manager", label: "Managers", color: "#2196F3", amount: summary.byRole?.manager || 0 },
              { role: "owner", label: "Owner", color: "#9C27B0", amount: summary.byRole?.owner || 0 },
            ].map((item) =>
              item.amount > 0 ? (
                <View key={item.role} style={styles.roleItem}>
                  <View style={[styles.roleDot, { backgroundColor: item.color }]} />
                  <Text variant="bodySmall" style={styles.roleLabel}>
                    {item.label}
                  </Text>
                  <Text variant="bodySmall" style={[styles.roleAmount, { color: item.color }]}>
                    Rs.{item.amount}
                  </Text>
                </View>
              ) : null
            )}
          </View>
        </Surface>
      )}

      {/* Pie chart */}
      {renderPieChart()}

      {/* Turf filter */}
      {turfs.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
        >
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                !selectedTurfId && styles.filterChipSelected,
              ]}
              onPress={() => setSelectedTurfId(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !selectedTurfId && styles.filterChipTextSelected,
                ]}
              >
                All Turfs
              </Text>
            </TouchableOpacity>
            {turfs.map((turf) => (
              <TouchableOpacity
                key={turf.id}
                style={[
                  styles.filterChip,
                  selectedTurfId === turf.id && styles.filterChipSelected,
                ]}
                onPress={() =>
                  setSelectedTurfId(selectedTurfId === turf.id ? null : turf.id)
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTurfId === turf.id && styles.filterChipTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {turf.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollView}
      >
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              !filterCategory && styles.filterChipSelected,
            ]}
            onPress={() => setFilterCategory(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                !filterCategory && styles.filterChipTextSelected,
              ]}
            >
              All Categories
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterChip,
                filterCategory === cat.id && styles.filterChipSelected,
              ]}
              onPress={() =>
                setFilterCategory(filterCategory === cat.id ? null : cat.id)
              }
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={14}
                color={filterCategory === cat.id ? "#fff" : OWNER_COLOR}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filterCategory === cat.id && styles.filterChipTextSelected,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  // Render expense item
  const renderExpenseItem = ({ item }) => {
    const iconName = getCategoryIcon(item.category, "owner");
    const categoryLabel = getCategoryLabel(item.category, "owner");
    const hasReceipt =
      (item.receiptImages && item.receiptImages.length > 0) || item.receiptImage;
    const own = isOwnExpense(item);

    return (
      <Surface style={styles.expenseCard} elevation={1}>
        <View style={styles.expenseCardContent}>
          <View style={styles.expenseRow}>
            <View style={styles.expenseCategoryIcon}>
              <MaterialCommunityIcons
                name={iconName}
                size={24}
                color={OWNER_COLOR}
              />
            </View>
            <View style={styles.expenseDetails}>
              <View style={styles.expenseHeaderRow}>
                <Text variant="titleSmall" style={styles.expenseCategoryLabel}>
                  {categoryLabel}
                </Text>
                <Text variant="titleMedium" style={styles.expenseAmount}>
                  Rs.{item.amount}
                </Text>
              </View>
              {item.subcategory ? (
                <Text variant="bodySmall" style={styles.expenseSubcategory}>
                  {formatSubcategory(item.subcategory)}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={styles.expenseDate}>
                {formatDisplayDate(item.date)} · {getTurfName(item.turfId)}
              </Text>
              {item.description ? (
                <Text
                  variant="bodySmall"
                  style={styles.expenseDescription}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.expenseMeta}>
                {hasReceipt && (
                  <View style={styles.receiptIndicator}>
                    <MaterialCommunityIcons name="receipt" size={14} color="#666" />
                    <Text variant="bodySmall" style={styles.receiptText}>
                      Receipt
                    </Text>
                  </View>
                )}
                <Text variant="bodySmall" style={styles.addedByText}>
                  {item.addedByName || "User"} ({item.addedByRole || "staff"})
                </Text>
              </View>
            </View>
          </View>

          {/* Actions - only own expenses & if operational permissions */}
          {own && hasOperationalPermissions && (
            <View style={styles.expenseActions}>
              <IconButton
                icon="pencil-outline"
                size={20}
                iconColor={OWNER_COLOR}
                onPress={() => openEditModal(item)}
              />
              <IconButton
                icon="delete-outline"
                size={20}
                iconColor="#F44336"
                onPress={() => handleDelete(item)}
              />
            </View>
          )}
        </View>
      </Surface>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="cash-register" size={64} color="#ccc" />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No Expenses Found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {selectedTurfId || filterCategory
          ? "No expenses match the current filters."
          : "No expenses recorded yet across your turfs."}
      </Text>
    </View>
  );

  // Render add/edit modal
  const renderModal = () => {
    if (!hasOperationalPermissions) return null;

    const subcategories = getSubcategories();

    return (
      <RNModal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text variant="titleLarge" style={styles.modalTitle}>
                  {editingExpense ? "Edit Expense" : "Add Expense"}
                </Text>
                <IconButton icon="close" size={24} onPress={closeModal} />
              </View>

              {/* Turf selector in form */}
              <Text variant="titleSmall" style={styles.formLabel}>
                Turf *
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScrollView}
              >
                <View style={styles.chipRow}>
                  {turfs.map((turf) => (
                    <TouchableOpacity
                      key={turf.id}
                      style={[
                        styles.categoryChip,
                        formTurfId === turf.id && styles.categoryChipSelected,
                      ]}
                      onPress={() => setFormTurfId(turf.id)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          formTurfId === turf.id && styles.categoryChipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {turf.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Category */}
              <Text variant="titleSmall" style={styles.formLabel}>
                Category *
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScrollView}
              >
                <View style={styles.chipRow}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        selectedCategory === cat.id && styles.categoryChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedCategory(cat.id);
                        setSelectedSubcategory(null);
                      }}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon}
                        size={18}
                        color={selectedCategory === cat.id ? "#fff" : OWNER_COLOR}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          selectedCategory === cat.id && styles.categoryChipTextSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Subcategory */}
              {subcategories.length > 0 && (
                <>
                  <Text variant="titleSmall" style={styles.formLabel}>
                    Subcategory
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScrollView}
                  >
                    <View style={styles.chipRow}>
                      {subcategories.map((sub) => (
                        <TouchableOpacity
                          key={sub}
                          style={[
                            styles.categoryChip,
                            selectedSubcategory === sub && styles.categoryChipSelected,
                          ]}
                          onPress={() =>
                            setSelectedSubcategory(
                              selectedSubcategory === sub ? null : sub
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.categoryChipText,
                              selectedSubcategory === sub && styles.categoryChipTextSelected,
                            ]}
                          >
                            {formatSubcategory(sub)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* Amount */}
              <Text variant="titleSmall" style={styles.formLabel}>
                Amount *
              </Text>
              <TextInput
                mode="outlined"
                label="Amount (Rs.)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={styles.formInput}
                outlineColor="#E0E0E0"
                activeOutlineColor={OWNER_COLOR}
                left={<TextInput.Icon icon="currency-inr" />}
              />

              {/* Description */}
              <Text variant="titleSmall" style={styles.formLabel}>
                Description
              </Text>
              <TextInput
                mode="outlined"
                label="Description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={styles.formInput}
                outlineColor="#E0E0E0"
                activeOutlineColor={OWNER_COLOR}
                autoCorrect={false}
                spellCheck={false}
              />

              {/* Date */}
              <Text variant="titleSmall" style={styles.formLabel}>
                Date *
              </Text>
              <TextInput
                mode="outlined"
                label="Date"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                style={styles.formInput}
                outlineColor="#E0E0E0"
                activeOutlineColor={OWNER_COLOR}
                left={<TextInput.Icon icon="calendar" />}
              />

              {/* Receipt Images */}
              <Text variant="titleSmall" style={styles.formLabel}>
                Receipt Images ({receiptImages.length}/3)
              </Text>
              <View style={styles.receiptImageGrid}>
                {receiptImages.map((uri, index) => (
                  <View key={index} style={styles.receiptImageContainer}>
                    <Image
                      source={{ uri }}
                      style={styles.receiptImagePreview}
                    />
                    <IconButton
                      icon="close-circle"
                      size={20}
                      style={styles.removeImageButton}
                      iconColor="#F44336"
                      containerColor="#fff"
                      onPress={() => removeImage(index)}
                    />
                  </View>
                ))}
                {receiptImages.length < 3 && (
                  <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                    <MaterialCommunityIcons name="camera-plus" size={28} color="#666" />
                    <Text variant="bodySmall" style={styles.addImageText}>
                      Add Photo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={closeModal}
                  style={styles.cancelButton}
                  textColor="#666"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                  style={styles.submitButton}
                  buttonColor={OWNER_COLOR}
                >
                  {editingExpense ? "Update" : "Add Expense"}
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
          </View>
        </View>
      </RNModal>
    );
  };

  // Loading
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Company Expenses
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OWNER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading expenses...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Company Expenses
        </Text>
        <IconButton
          icon="download"
          iconColor={OWNER_COLOR}
          onPress={handleExport}
        />
      </View>

      {/* Expense List */}
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[OWNER_COLOR]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB - only if operational permissions */}
      {hasOperationalPermissions && (
        <FAB
          icon="plus"
          style={styles.fab}
          color="#fff"
          onPress={openAddModal}
        />
      )}

      {/* Modal */}
      {renderModal()}
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
    justifyContent: "space-between",
    paddingRight: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#666",
    marginTop: 12,
  },

  // Summary Card
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  summaryContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3E5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryInfo: {
    marginLeft: 16,
    flex: 1,
  },
  summaryLabel: {
    color: "#666",
  },
  summaryAmount: {
    fontWeight: "bold",
    color: OWNER_COLOR,
    marginTop: 2,
  },
  summaryCount: {
    color: "#999",
    marginTop: 2,
  },

  // Role breakdown
  roleCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  roleTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  roleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleLabel: {
    color: "#666",
  },
  roleAmount: {
    fontWeight: "600",
  },

  // Pie Chart
  pieCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  pieTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  pieContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  pieLegend: {
    flex: 1,
    marginLeft: 16,
  },
  pieLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pieLegendLabel: {
    flex: 1,
    color: "#555",
  },
  pieLegendValue: {
    color: "#333",
    fontWeight: "600",
  },

  // Filters
  filterScrollView: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OWNER_COLOR,
    backgroundColor: "#fff",
    gap: 4,
  },
  filterChipSelected: {
    backgroundColor: OWNER_COLOR,
    borderColor: OWNER_COLOR,
  },
  filterChipText: {
    color: OWNER_COLOR,
    fontSize: 12,
    fontWeight: "500",
  },
  filterChipTextSelected: {
    color: "#fff",
  },

  // Expense Card
  expenseCard: {
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 12,
  },
  expenseCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  expenseRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  expenseCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3E5F5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expenseCategoryLabel: {
    fontWeight: "600",
    color: "#333",
  },
  expenseAmount: {
    fontWeight: "bold",
    color: OWNER_COLOR,
  },
  expenseSubcategory: {
    color: "#888",
    marginTop: 2,
  },
  expenseDate: {
    color: "#999",
    marginTop: 4,
  },
  expenseDescription: {
    color: "#666",
    marginTop: 4,
    lineHeight: 18,
  },
  expenseMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 12,
  },
  receiptIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  receiptText: {
    color: "#666",
    fontSize: 12,
  },
  addedByText: {
    color: "#999",
    fontSize: 12,
    fontStyle: "italic",
  },
  expenseActions: {
    flexDirection: "column",
    alignItems: "center",
    marginLeft: 4,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptyText: {
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: OWNER_COLOR,
    borderRadius: 28,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  formLabel: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 12,
  },
  chipScrollView: {
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    flexWrap: "wrap",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OWNER_COLOR,
    backgroundColor: "#fff",
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: OWNER_COLOR,
    borderColor: OWNER_COLOR,
  },
  categoryChipText: {
    color: OWNER_COLOR,
    fontSize: 13,
    fontWeight: "500",
  },
  categoryChipTextSelected: {
    color: "#fff",
  },
  formInput: {
    backgroundColor: "#fff",
    marginBottom: 4,
  },

  // Receipt Images
  receiptImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  receiptImageContainer: {
    position: "relative",
  },
  receiptImagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    margin: 0,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  addImageText: {
    color: "#666",
    marginTop: 4,
    fontSize: 11,
  },

  // Modal Actions
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  cancelButton: {
    borderRadius: 8,
    borderColor: "#E0E0E0",
  },
  submitButton: {
    borderRadius: 8,
  },
});
