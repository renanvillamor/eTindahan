import { CARD_COLORS } from "@/constants/Constants";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { formatCurrency } from "@/lib/utils";
import { FREQUENCY_LABELS } from "@/lib/recurringExpense";
import { RecurringExpense } from "@/models/RecurringExpense";
import { useDeleteRecurringExpense } from "@/services/useDeleteRecurringExpense";
import { useGetRecurringExpenses } from "@/services/useGetRecurringExpenses";
import { useSaveRecurringExpense } from "@/services/useSaveRecurringExpense";
import { format, isValid, parseISO } from "date-fns";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import {
  ActivityIndicator,
  FAB,
  Icon,
  IconButton,
} from "react-native-paper";
import { useStore } from "../../../../store/useStore";
import ConfirmDialog from "../../shared/ConfirmDialog";
import RecurringExpenseDetailsBottomSheet from "./RecurringExpenseDetailsBottomSheet";

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const dt = parseISO(iso.slice(0, 10));
    return isValid(dt) ? format(dt, "MMM d, yyyy") : "—";
  } catch {
    return "—";
  }
}

export default function RecurringExpensesScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const { showSnackbar } = useSnackbar();

  const recurringExpenses = useStore((s) => s.recurringExpenses) ?? [];
  const expenseCategories = useStore((s) => s.expenseCategories) ?? [];
  const updateRecurringExpense = useStore((s) => s.updateRecurringExpense);
  const removeRecurringExpense = useStore((s) => s.removeRecurringExpense);
  const {
    isLoading: isLoadingTemplates,
    error: templatesError,
    refetch: refetchTemplates,
  } = useGetRecurringExpenses();

  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);

  const saveMutation = useSaveRecurringExpense();
  const deleteMutation = useDeleteRecurringExpense();

  const sorted = useMemo(
    () =>
      [...recurringExpenses].sort((a, b) =>
        a.nextDueDate.localeCompare(b.nextDueDate),
      ),
    [recurringExpenses],
  );

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({
      id: 0,
      expenseCategoryId: 0,
      amount: 0,
      frequency: "monthly",
      nextDueDate: format(new Date(), "yyyy-MM-dd"),
      remarks: null,
      isActive: true,
    });
  };

  const handleEdit = (item: RecurringExpense) => {
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  const handleSave = (template: Omit<RecurringExpense, "id">) => {
    const payload: RecurringExpense = {
      id: editingItem?.id ?? 0,
      ...template,
    };
    saveMutation.mutate(payload, {
      onSuccess: (saved) => {
        updateRecurringExpense(saved);
        showSnackbar(
          isAddMode
            ? "Recurring expense added successfully."
            : "Recurring expense updated successfully.",
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
        removeRecurringExpense(deletingId);
        setDeletingId(null);
        showSnackbar("Recurring expense deleted successfully.", "success");
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
          title: "Recurring Expenses",
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
        {isLoadingTemplates ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-400 text-sm">
              Loading recurring expenses…
            </Text>
          </View>
        ) : templatesError ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Icon source="alert-circle-outline" size={48} color="#ef4444" />
            <Text className="text-red-500 text-center">
              {templatesError.message}
            </Text>
            <Text
              className="text-blue-600 text-sm font-medium"
              onPress={() => refetchTemplates()}
            >
              Tap to retry
            </Text>
          </View>
        ) : sorted.length > 0 ? (
          <FlatList
            data={sorted}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const initials = (item.expenseCategoryName ?? "?")
                .substring(0, 2)
                .toUpperCase();
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
                      <View className="flex-row items-center gap-2">
                        <Text className="text-gray-800 font-semibold text-base">
                          {item.expenseCategoryName ?? "Uncategorized"}
                        </Text>
                        {!item.isActive && (
                          <Text className="text-xs text-gray-400">
                            (inactive)
                          </Text>
                        )}
                      </View>
                      <Text className="text-xs text-gray-500">
                        {formatCurrency(item.amount)} ·{" "}
                        {FREQUENCY_LABELS[item.frequency]} · Next:{" "}
                        {formatDateLabel(item.nextDueDate)}
                      </Text>
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
              No recurring expenses
            </Text>
          </View>
        )}

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      <RecurringExpenseDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        expenseCategories={expenseCategories}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />

      <ConfirmDialog
        visible={deletingId !== null}
        title="Delete Recurring Expense"
        message="Are you sure you want to delete this recurring expense template?"
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
