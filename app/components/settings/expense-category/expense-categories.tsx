import { CARD_COLORS } from "@/constants/Constants";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { useDeleteExpenseCategory } from "@/services/useDeleteExpenseCategory";
import { useGetExpenseCategories } from "@/services/useGetExpenseCategories";
import { useSaveExpenseCategory } from "@/services/useSaveExpenseCategory";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import {
  ActivityIndicator,
  FAB,
  Icon,
  IconButton,
  Searchbar,
} from "react-native-paper";
import { useStore } from "../../../../store/useStore";
import ConfirmDialog from "../../shared/ConfirmDialog";
import ExpenseCategoryDetailsBottomSheet from "./ExpenseCategoryDetailsBottomSheet";

export default function ExpenseCategoriesScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const { showSnackbar } = useSnackbar();

  const expenseCategories = useStore((s) => s.expenseCategories) ?? [];
  const updateExpenseCategory = useStore((s) => s.updateExpenseCategory);
  const removeExpenseCategory = useStore((s) => s.removeExpenseCategory);
  const {
    isLoading: isLoadingCategories,
    error: categoriesError,
    refetch: refetchCategories,
  } = useGetExpenseCategories();

  const [editingItem, setEditingItem] = useState<ExpenseCategory | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [query, setQuery] = useState("");

  const saveMutation = useSaveExpenseCategory();
  const deleteMutation = useDeleteExpenseCategory();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q
      ? expenseCategories.filter((c) => c.name.toLowerCase().includes(q))
      : expenseCategories;
    return [...source].sort((a, b) => a.name.localeCompare(b.name));
  }, [expenseCategories, query]);

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({ id: 0, name: "", isOpex: false, isActive: true });
  };

  const handleEdit = (item: ExpenseCategory) => {
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  const handleSave = (name: string, isOpex: boolean) => {
    const payload: ExpenseCategory = {
      id: editingItem?.id ?? 0,
      name,
      isOpex,
      isActive: editingItem?.isActive ?? true,
    };
    saveMutation.mutate(payload, {
      onSuccess: (saved) => {
        updateExpenseCategory(saved);
        showSnackbar(
          isAddMode
            ? "Expense category added successfully."
            : "Expense category updated successfully.",
          "success",
        );
        setEditingItem(null);
        setIsAddMode(false);
      },
      onError: (error) => {
        showSnackbar(error.message, "error");
      },
    });
  };

  const confirmDelete = () => {
    if (deletingId === null) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => {
        removeExpenseCategory(deletingId);
        setDeletingId(null);
        showSnackbar("Expense category deleted successfully.", "success");
      },
      onError: (error) => {
        showSnackbar(error.message, "error");
        setDeletingId(null);
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Expense Categories",
          headerTitleAlign: "center",
          animation: "slide_from_right",
          headerLeft: () => (
            <View className="w-12 h-12 items-center justify-center -ml-2">
              <IconButton
                icon="arrow-left"
                size={24}
                onPress={() => router.back()}
                accessibilityLabel="Back"
                className="m-0"
              />
            </View>
          ),
        }}
      />

      <View className="flex-1 bg-gray-50">
        <View className="px-4 pt-4 pb-2">
          <Searchbar
            placeholder="Search expense categories"
            value={query}
            onChangeText={setQuery}
            style={styles.searchbar}
          />
        </View>

        {isLoadingCategories ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-400 text-sm">
              Loading expense categories…
            </Text>
          </View>
        ) : categoriesError ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Icon source="alert-circle-outline" size={48} color="#ef4444" />
            <Text className="text-red-500 text-center">
              {categoriesError.message}
            </Text>
            <Text
              className="text-blue-600 text-sm font-medium"
              onPress={() => refetchCategories()}
            >
              Tap to retry
            </Text>
          </View>
        ) : filtered.length > 0 ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const initials = item.name.substring(0, 2).toUpperCase();
              const avatarBg = CARD_COLORS[index % CARD_COLORS.length];
              return (
                <View style={styles.card}>
                  <View className="flex-row items-center px-4 py-3">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: avatarBg }}
                    >
                      <Text className="text-white font-bold text-sm">
                        {initials}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-800 font-semibold text-base">
                        {item.name}
                      </Text>
                      {item.isOpex && (
                        <Text className="text-xs text-green-600 font-medium">
                          Operating expense
                        </Text>
                      )}
                    </View>
                    <IconButton
                      icon="pencil-outline"
                      size={20}
                      onPress={() => handleEdit(item)}
                      style={styles.iconButton}
                    />
                    <IconButton
                      icon="trash-can-outline"
                      size={20}
                      onPress={() => setDeletingId(item.id)}
                      style={styles.iconButton}
                    />
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-400 text-base">
              No expense categories
            </Text>
          </View>
        )}

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      <ExpenseCategoryDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />

      <ConfirmDialog
        visible={deletingId !== null}
        title="Delete Expense Category"
        message="Are you sure you want to delete this expense category?"
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onDismiss={() => setDeletingId(null)}
      />
    </>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    searchbar: {
      borderRadius: 12,
      elevation: 0,
      backgroundColor: colors.secondary,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 96,
    },
    card: {
      backgroundColor: "white",
      borderRadius: 16,
      marginBottom: 8,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    },
    iconButton: {
      margin: 0,
    },
    fab: {
      position: "absolute",
      right: 16,
      bottom: 32,
      backgroundColor: "#53B175",
      borderRadius: 28,
    },
  });
