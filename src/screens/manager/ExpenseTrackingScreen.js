import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  IconButton,
  ActivityIndicator,
  FAB,
  Portal,
  Modal,
  Menu,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import { selectUser, selectAssignedTurfIds } from "../../store/slices/authSlice";
import {
  addExpense,
  uploadReceiptImages,
  getExpensesForTurf,
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
import { getDocument } from "../../services/firebase/firestore";

const MANAGER_COLOR = "#2196F3";

const getTodayString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function ManagerExpenseTrackingScreen({ navigation }) {
  const user = useSelector(selectUser);
  const assignedTurfIds = useSelector(selectAssignedTurfIds);
  const categories = getCategoriesForRole("manager");

  // Turf data
  const [turfs, setTurfs] = useState([]);
  const [selectedTurfId, setSelectedTurfId] = useState(null);
  const [turfMenuVisible, setTurfMenuVisible] = useState(false);

  // List state
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, byCategory: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [filterCategory, setFilterCategory] = useState(null);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getTodayString());
  const [receiptImages, setReceiptImages] = useState([]);

  // Load turfs
  useEffect(() => {
    const loadTurfs = async () => {
      if (!assignedTurfIds || assignedTurfIds.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const turfPromises = assignedTurfIds.map((id) => getDocument("turfs", id));
        const turfDocs = await Promise.all(turfPromises);
        const validTurfs = turfDocs.filter(Boolean);
        setTurfs(validTurfs);
        if (validTurfs.length > 0) {
          setSelectedTurfId(validTurfs[0].id);
        }
      } catch (error) {
        console.error("Error loading turfs:", error);
        setLoading(false);
      }
    };
    loadTurfs();
  }, [assignedTurfIds]);

  // Fetch expenses when turf changes
  const fetchExpenses = useCallback(async () => {
    if (!selectedTurfId) {
      setLoading(false);
      return;
    }

    try {
      const filters = {};
      if (filterCategory) {
        filters.category = filterCategory;
      }
      const data = await getExpensesForTurf(selectedTurfId, filters);
      setExpenses(data);
      const expenseSummary = calculateExpenseSummary(data);
      setSummary(expenseSummary);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      Alert.alert("Error", "Failed to load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedTurfId, filterCategory]);

  useEffect(() => {
    if (selectedTurfId) {
      setLoading(true);
      fetchExpenses();
    }
  }, [selectedTurfId, filterCategory, fetchExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExpenses();
    setRefreshing(false);
  }, [fetchExpenses]);

  // Form helpers
  const resetForm = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
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

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library."
      );
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

  // Validate form
  const validateForm = () => {
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

  // Submit expense
  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!selectedTurfId) {
      Alert.alert("Error", "No turf selected.");
      return;
    }

    setSubmitting(true);

    try {
      if (editingExpense) {
        const updates = {
          category: selectedCategory,
          subcategory: selectedSubcategory || null,
          categoryLabel: getCategoryLabel(selectedCategory, "manager"),
          amount: parseFloat(amount),
          description: description.trim(),
          date,
        };

        const newLocalImages = receiptImages.filter(
          (uri) => !uri.startsWith("http")
        );
        if (newLocalImages.length > 0) {
          const uploadedUrls = await uploadReceiptImages(
            editingExpense.id,
            newLocalImages
          );
          const existingUrls = receiptImages.filter((uri) =>
            uri.startsWith("http")
          );
          const allUrls = [...existingUrls, ...uploadedUrls];
          updates.receiptImages = allUrls;
          updates.receiptImage = allUrls[0] || null;
        }

        await updateExpense(editingExpense.id, updates);
        Alert.alert("Success", "Expense updated successfully.");
      } else {
        const expenseData = {
          companyId: user.companyId || null,
          turfId: selectedTurfId,
          category: selectedCategory,
          subcategory: selectedSubcategory || null,
          categoryLabel: getCategoryLabel(selectedCategory, "manager"),
          amount: parseFloat(amount),
          description: description.trim(),
          date,
          receiptImages: [],
          receiptImage: null,
        };

        const result = await addExpense(expenseData, user);

        if (receiptImages.length > 0 && result.expenseId) {
          const urls = await uploadReceiptImages(
            result.expenseId,
            receiptImages
          );
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

  // Delete expense (only own expenses)
  const handleDelete = (expense) => {
    const userId = user?.userId || user?.uid;
    if (expense.addedBy !== userId) {
      Alert.alert("Not Allowed", "You can only delete expenses you added.");
      return;
    }

    Alert.alert(
      "Delete Expense",
      `Are you sure you want to delete this expense of Rs.${expense.amount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteExpense(expense.id);
              await fetchExpenses();
              Alert.alert("Deleted", "Expense deleted successfully.");
            } catch (error) {
              console.error("Error deleting expense:", error);
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

    const selectedTurf = turfs.find((t) => t.id === selectedTurfId);
    const turfName = selectedTurf?.name || "Turf";

    let csv = "Date,Category,Subcategory,Amount,Description,Added By,Role\n";
    expenses.forEach((e) => {
      csv += `${e.date || ""},${getCategoryLabel(e.category, "manager")},${formatSubcategory(e.subcategory) || ""},${e.amount || 0},"${(e.description || "").replace(/"/g, '""')}",${e.addedByName || ""},${e.addedByRole || ""}\n`;
    });

    csv += `\nTotal,,,,${summary.total || 0},,\n`;

    try {
      await Share.share({
        message: csv,
        title: `${turfName} Expenses Export`,
      });
    } catch (error) {
      console.error("Error exporting:", error);
    }
  };

  // Format date for display
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

  const isOwnExpense = (expense) => {
    const userId = user?.userId || user?.uid;
    return expense.addedBy === userId;
  };

  // Render summary card
  const renderSummaryCard = () => (
    <View>
      <Surface style={styles.summaryCard} elevation={1}>
        <View style={styles.summaryContent}>
          <View style={styles.summaryIconContainer}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={32}
              color={MANAGER_COLOR}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text variant="bodySmall" style={styles.summaryLabel}>
              Total Expenses
            </Text>
            <Text variant="headlineMedium" style={styles.summaryAmount}>
              Rs.{summary.total || 0}
            </Text>
            <Text variant="bodySmall" style={styles.summaryCount}>
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""} recorded
            </Text>
          </View>
          <IconButton
            icon="download"
            size={24}
            iconColor={MANAGER_COLOR}
            onPress={handleExport}
          />
        </View>
      </Surface>

      {/* Category breakdown */}
      {Object.keys(summary.byCategory || {}).length > 0 && (
        <Surface style={styles.breakdownCard} elevation={1}>
          <Text variant="titleSmall" style={styles.breakdownTitle}>
            By Category
          </Text>
          {Object.entries(summary.byCategory).map(([catId, catAmount]) => (
            <View key={catId} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <MaterialCommunityIcons
                  name={getCategoryIcon(catId, "manager")}
                  size={16}
                  color={MANAGER_COLOR}
                />
                <Text variant="bodySmall" style={styles.breakdownLabel}>
                  {getCategoryLabel(catId, "manager")}
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.breakdownAmount}>
                Rs.{catAmount}
              </Text>
            </View>
          ))}
        </Surface>
      )}

      {/* Filter chips */}
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
              All
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
                color={filterCategory === cat.id ? "#fff" : MANAGER_COLOR}
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
    const iconName = getCategoryIcon(item.category, "manager");
    const categoryLabel = getCategoryLabel(item.category, "manager");
    const hasReceipt =
      (item.receiptImages && item.receiptImages.length > 0) ||
      item.receiptImage;
    const own = isOwnExpense(item);

    return (
      <Surface style={styles.expenseCard} elevation={1}>
        <View style={styles.expenseCardContent}>
          <View style={styles.expenseRow}>
            <View style={styles.expenseCategoryIcon}>
              <MaterialCommunityIcons
                name={iconName}
                size={24}
                color={MANAGER_COLOR}
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
                {formatDisplayDate(item.date)}
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
                    <MaterialCommunityIcons
                      name="receipt"
                      size={14}
                      color="#666"
                    />
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

          {/* Action buttons - only for own expenses */}
          {own && (
            <View style={styles.expenseActions}>
              <IconButton
                icon="pencil-outline"
                size={20}
                iconColor={MANAGER_COLOR}
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

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="cash-register"
        size={64}
        color="#ccc"
      />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No Expenses Found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {filterCategory
          ? "No expenses match the current filter. Try a different category."
          : "Tap the + button to add your first expense."}
      </Text>
    </View>
  );

  // Render modal
  const renderModal = () => {
    const subcategories = getSubcategories();

    return (
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={closeModal}
          contentContainerStyle={styles.modalContainer}
        >
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

              {/* Category Selector */}
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
                        selectedCategory === cat.id &&
                          styles.categoryChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedCategory(cat.id);
                        setSelectedSubcategory(null);
                      }}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon}
                        size={18}
                        color={
                          selectedCategory === cat.id ? "#fff" : MANAGER_COLOR
                        }
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          selectedCategory === cat.id &&
                            styles.categoryChipTextSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Subcategory Selector */}
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
                            selectedSubcategory === sub &&
                              styles.categoryChipSelected,
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
                              selectedSubcategory === sub &&
                                styles.categoryChipTextSelected,
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
                activeOutlineColor={MANAGER_COLOR}
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
                activeOutlineColor={MANAGER_COLOR}
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
                activeOutlineColor={MANAGER_COLOR}
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
                  <TouchableOpacity
                    style={styles.addImageButton}
                    onPress={pickImage}
                  >
                    <MaterialCommunityIcons
                      name="camera-plus"
                      size={28}
                      color="#666"
                    />
                    <Text variant="bodySmall" style={styles.addImageText}>
                      Add Photo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Buttons */}
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
                  buttonColor={MANAGER_COLOR}
                >
                  {editingExpense ? "Update" : "Add Expense"}
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Expenses
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading expenses...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedTurf = turfs.find((t) => t.id === selectedTurfId);
  const hasMultipleTurfs = turfs.length > 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Expenses
        </Text>
        <IconButton
          icon="download"
          iconColor={MANAGER_COLOR}
          onPress={handleExport}
        />
      </View>

      {/* Turf Selector */}
      {turfs.length > 0 && (
        <View style={styles.turfSelectorContainer}>
          {hasMultipleTurfs ? (
            <Menu
              visible={turfMenuVisible}
              onDismiss={() => setTurfMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.turfSelectorButton}
                  onPress={() => setTurfMenuVisible(true)}
                >
                  <MaterialCommunityIcons
                    name="soccer-field"
                    size={18}
                    color={MANAGER_COLOR}
                  />
                  <Text
                    variant="titleSmall"
                    style={styles.turfSelectorText}
                    numberOfLines={1}
                  >
                    {selectedTurf?.name || "Select Turf"}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color="#666"
                  />
                </TouchableOpacity>
              }
              contentStyle={{ backgroundColor: "#fff" }}
            >
              {turfs.map((turf) => (
                <Menu.Item
                  key={turf.id}
                  onPress={() => {
                    setSelectedTurfId(turf.id);
                    setTurfMenuVisible(false);
                  }}
                  title={turf.name}
                  leadingIcon={
                    turf.id === selectedTurfId
                      ? "check-circle"
                      : "circle-outline"
                  }
                />
              ))}
            </Menu>
          ) : (
            <View style={styles.turfSelectorButton}>
              <MaterialCommunityIcons
                name="soccer-field"
                size={18}
                color={MANAGER_COLOR}
              />
              <Text
                variant="titleSmall"
                style={styles.turfSelectorText}
                numberOfLines={1}
              >
                {selectedTurf?.name || "No Turf"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Expense List */}
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        ListHeaderComponent={renderSummaryCard}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[MANAGER_COLOR]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={openAddModal}
      />

      {/* Add/Edit Modal */}
      {renderModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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

  // Turf Selector
  turfSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  turfSelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  turfSelectorText: {
    flex: 1,
    color: "#333",
    fontWeight: "600",
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
    backgroundColor: "#E3F2FD",
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
    color: MANAGER_COLOR,
    marginTop: 2,
  },
  summaryCount: {
    color: "#999",
    marginTop: 2,
  },

  // Breakdown Card
  breakdownCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  breakdownTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  breakdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  breakdownLabel: {
    color: "#555",
  },
  breakdownAmount: {
    fontWeight: "600",
    color: "#333",
  },

  // Filter
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
    borderColor: MANAGER_COLOR,
    backgroundColor: "#fff",
    gap: 4,
  },
  filterChipSelected: {
    backgroundColor: MANAGER_COLOR,
    borderColor: MANAGER_COLOR,
  },
  filterChipText: {
    color: MANAGER_COLOR,
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
    backgroundColor: "#E3F2FD",
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
    color: MANAGER_COLOR,
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
    backgroundColor: MANAGER_COLOR,
    borderRadius: 28,
  },

  // Modal
  modalContainer: {
    backgroundColor: "#fff",
    margin: 16,
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
    borderColor: MANAGER_COLOR,
    backgroundColor: "#fff",
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: MANAGER_COLOR,
    borderColor: MANAGER_COLOR,
  },
  categoryChipText: {
    color: MANAGER_COLOR,
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
