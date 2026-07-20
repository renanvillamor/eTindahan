import ConfirmDialog from "@/app/components/shared/ConfirmDialog";
import DateSelector from "@/app/components/shared/DateSelector";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { formatCurrency } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { useDeleteExpense } from "@/services/useDeleteExpense";
import { fetchExpenses } from "@/services/useGetExpenses";
import { useSaveExpense } from "@/services/useSaveExpense";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { format, isValid, parseISO } from "date-fns";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Card, Divider, FAB, IconButton, List, Text } from "react-native-paper";
import { useStore } from "../../../store/useStore";
import ExpenseDetailsBottomSheet from "./ExpenseDetailsBottomSheet";

type ExpenseGroup = {
  key: string;
  sourceDate: string | null;
  payeeId: number | null;
  payeeName: string | null;
  totalAmount: number;
  expenses: Expense[];
};

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const dt = parseISO(iso.slice(0, 10));
    return isValid(dt) ? format(dt, "MMM d, yyyy") : "—";
  } catch {
    return "—";
  }
}

function ExpenseGroupRow({
  group,
  onPress,
}: {
  group: ExpenseGroup;
  onPress: (item: Expense) => void;
}) {
  return (
    <Card
      className="mx-4 my-2 rounded-xl overflow-hidden bg-white"
      elevation={1}
    >
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-sm font-medium text-gray-800 flex-1 pr-3">
          {group.payeeName ?? "No payee"}
        </Text>
        <Text className="text-sm text-gray-700 text-right">
          {formatDateLabel(group.sourceDate)}
        </Text>
      </View>

      <Divider />

      <View className="px-4 pt-4 pb-3 gap-2">
        <Text className="text-sm text-gray-700">Payment Breakdown:</Text>
        {group.expenses.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            onPress={() => onPress(item)}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm text-gray-700">
                  {formatDateLabel(item.sourceDate)} -{" "}
                  {item.sourceTypeDescription ?? ""}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-medium text-gray-700">
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Divider />

      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-sm text-gray-500">TOTAL</Text>
        <Text className="text-base font-bold text-gray-800">
          {formatCurrency(group.totalAmount)}
        </Text>
      </View>
    </Card>
  );
}

export default function ExpensesScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const { showSnackbar } = useSnackbar();

  const suppliers = useStore((s) => s.suppliers) ?? [];
  const itemTypes = useStore((s) => s.itemTypes) ?? [];
  const saveMutation = useSaveExpense();
  const deleteMutation = useDeleteExpense();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [actionTarget, setActionTarget] = useState<Expense | null>(null);
  const actionSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (actionTarget) {
      actionSheetRef.current?.snapToIndex(0);
    } else {
      actionSheetRef.current?.close();
    }
  }, [actionTarget]);

  const syncExpenses = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const latest = await fetchExpenses();
      setExpenses(latest);
    } catch (error) {
      showSnackbar((error as Error).message, "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [showSnackbar]);

  useFocusEffect(
    useCallback(() => {
      syncExpenses();
    }, [syncExpenses]),
  );

  // Filter/group by sourceDate (the date the user attributes the expense
  // to), not createdAt (when the row was inserted) — every other screen
  // that totals expenses by day (Dashboard, Daily Summary, Financial
  // Standing) already keys off source_date, so this must match or the same
  // expense can show under different days on different screens.
  const filtered = useMemo(() => {
    const selectedStr = format(selectedDate, "yyyy-MM-dd");
    return expenses.filter((e) => e.sourceDate?.slice(0, 10) === selectedStr);
  }, [expenses, selectedDate]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, e) => sum + Number(e.amount ?? 0), 0),
    [filtered],
  );

  const groupedExpenses = useMemo<ExpenseGroup[]>(() => {
    const groups = new Map<string, ExpenseGroup>();

    for (const expense of filtered) {
      const sourceDate = expense.sourceDate ?? null;
      const payeeId = expense.payeeId ?? null;
      const key = `${sourceDate ?? "no-date"}::${payeeId ?? "no-payee"}`;
      const existing = groups.get(key);

      if (existing) {
        existing.totalAmount += Number(expense.amount ?? 0);
        existing.expenses.push(expense);
        continue;
      }

      groups.set(key, {
        key,
        sourceDate,
        payeeId,
        payeeName: expense.payeeName ?? null,
        totalAmount: Number(expense.amount ?? 0),
        expenses: [expense],
      });
    }

    return Array.from(groups.values());
  }, [filtered]);

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({ id: 0, amount: 0 });
  };

  const handleEdit = (item: Expense) => {
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  const handleSave = (expense: Expense) => {
    saveMutation.mutate(expense, {
      onSuccess: async () => {
        await syncExpenses();
        showSnackbar(
          isAddMode
            ? "Expense added successfully."
            : "Expense updated successfully.",
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

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: async () => {
        await syncExpenses();
        showSnackbar("Expense deleted.", "success");
        setDeleteTarget(null);
      },
      onError: (error) => {
        showSnackbar(error.message, "error");
        setDeleteTarget(null);
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Expenses",
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
        <View className="bg-white border-b border-gray-200">
          <DateSelector value={selectedDate} onChange={setSelectedDate} />
        </View>

        {groupedExpenses.length > 0 ? (
          <FlatList
            data={groupedExpenses}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={syncExpenses}
              />
            }
            renderItem={({ item }) => (
              <ExpenseGroupRow group={item} onPress={setActionTarget} />
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400 text-base">No expenses found</Text>
          </View>
        )}

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      {/* Bottom total footer */}
      <View style={[styles.footer, { borderTopColor: colors.surfaceDisabled }]}>
        <View className="flex-1">
          <Text className="text-xs text-gray-500">Total</Text>
          <Text className="text-xl font-bold text-gray-800">
            {formatCurrency(totalAmount)}
          </Text>
        </View>
      </View>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Expense"
        message={`Delete this expense of ${deleteTarget ? formatCurrency(deleteTarget.amount) : ""}? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onDismiss={() => setDeleteTarget(null)}
      />

      {/* Action sheet: tap a card to edit or delete */}
      <BottomSheet
        ref={actionSheetRef}
        index={-1}
        snapPoints={["22%"]}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            pressBehavior="close"
          />
        )}
        backgroundStyle={{ backgroundColor: colors.surface }}
        onChange={(idx) => {
          if (idx === -1) setActionTarget(null);
        }}
      >
        <BottomSheetView>
          <List.Item
            title="Edit"
            left={(props) => <List.Icon {...props} icon="pencil-outline" />}
            onPress={() => {
              const target = actionTarget;
              setActionTarget(null);
              if (target) handleEdit(target);
            }}
          />
          <Divider />
          <List.Item
            title="Delete"
            titleStyle={{ color: "#ef4444" }}
            left={(props) => (
              <List.Icon {...props} icon="trash-can-outline" color="#ef4444" />
            )}
            onPress={() => {
              const target = actionTarget;
              setActionTarget(null);
              if (target) setDeleteTarget(target);
            }}
          />
        </BottomSheetView>
      </BottomSheet>

      <ExpenseDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        suppliers={suppliers}
        itemTypes={itemTypes}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />
    </>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: 16,
    },
    fab: {
      position: "absolute",
      right: 16,
      bottom: 16,
      borderRadius: 28,
      backgroundColor: colors.primary,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      backgroundColor: colors.surface,
    },
  });
