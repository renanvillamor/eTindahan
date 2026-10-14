import ConfirmDialog from "@/app/components/shared/ConfirmDialog";
import NotificationsBottomSheet from "@/app/components/shared/NotificationsBottomSheet";
import SaleDetailSheet from "@/app/components/shared/SaleDetailSheet";
import { CARD_COLORS } from "@/constants/Constants";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDueRecurringExpenses } from "@/hooks/useDueRecurringExpenses";
import { useSnackbar } from "@/lib/SnackbarContext";
import useSafePush from "@/lib/useSafePush";
import { advanceDueDate } from "@/lib/recurringExpense";
import { formatCurrency } from "@/lib/utils";
import { RecurringExpense } from "@/models/RecurringExpense";
import { SaleToday } from "@/models/SaleToday";
import {
  syncPendingDeletions,
  useMarkSaleForDeletion,
  useUndoSaleDeletion,
} from "@/services/useDeleteSale";
import { useGetExpensesToday } from "@/services/useGetExpensesToday";
import { useGetSalesToday } from "@/services/useGetSalesToday";
import { useSaveRecurringExpense } from "@/services/useSaveRecurringExpense";
import { useStore } from "@/store/useStore";
import { format } from "date-fns";
import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text as RNText,
  StyleSheet,
  View,
} from "react-native";
import {
  Badge,
  Card,
  Divider,
  FAB,
  IconButton,
  List,
  Text,
} from "react-native-paper";

const SaleTodayRow = memo(function SaleTodayRow({
  item,
  onPress,
}: {
  item: SaleToday;
  onPress: (item: SaleToday) => void;
}) {
  const timeLabel = item.transactionDate
    ? format(new Date(item.transactionDate), "h:mm a")
    : null;
  const isPendingDelete = item.pendingDelete === true;
  const isUnsynced = item.synced === false;
  const bgClass = isPendingDelete
    ? "bg-amber-50"
    : isUnsynced
      ? "bg-red-300"
      : "";
  return (
    <View className={bgClass}>
      <List.Item
        title={item.name}
        titleNumberOfLines={1}
        titleStyle={isPendingDelete ? rowStyles.strikethrough : undefined}
        onPress={() => onPress(item)}
        description={() => (
          <RNText className="text-xs text-gray-500">{timeLabel ?? ""}</RNText>
        )}
        descriptionNumberOfLines={1}
        style={saleRowStyle}
        right={() => (
          <View style={saleAmountBlock}>
            <RNText
              className={
                isPendingDelete
                  ? "text-md font-semibold text-gray-400"
                  : "text-md font-semibold text-gray-800"
              }
            >
              {formatCurrency(item.total)}
            </RNText>
            <View style={salePriceRow}>
              {item.paymentMode ? (
                <RNText style={saleModeInline} numberOfLines={1}>
                  {item.paymentMode}
                  {"  "}
                </RNText>
              ) : null}
              <RNText className="text-sm text-gray-400" numberOfLines={1}>
                {formatCurrency(item.price)} × {item.quantity} {item.uom ?? ""}
              </RNText>
            </View>
          </View>
        )}
      />
    </View>
  );
});

const saleRowStyle = { paddingVertical: 4, paddingRight: 0 };
const saleAmountBlock = {
  justifyContent: "center" as const,
  alignItems: "flex-end" as const,
  paddingRight: 8,
};
const salePriceRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
};
const saleModeInline: import("react-native").TextStyle = {
  fontSize: 11,
  color: "#6366f1",
  fontWeight: "600",
};

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const safePush = useSafePush();
  const [fabOpen, setFabOpen] = useState(false);
  const fabStyles = useFabStyles(colors);
  const { isFetching: isFetchingSales, refetch: refetchSales } =
    useGetSalesToday();
  const sales = useStore((s) => s.salesToday);
  const itemTypes = useStore((s) => s.itemTypes);
  const {
    data: expensesToday = [],
    isFetching: isFetchingExpenses,
    refetch: refetchExpenses,
  } = useGetExpensesToday();

  const isRefreshing = isFetchingSales || isFetchingExpenses;

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchSales(), refetchExpenses()]);
  }, [refetchExpenses, refetchSales]);

  // Guard against persisted yesterday's data showing before the fresh fetch resolves
  const todaySales = useMemo(() => {
    const now = new Date();
    const startMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const endMs = startMs + 86400000 - 1;
    return sales.filter((s) => {
      const t = new Date(s.transactionDate).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [sales]);

  const sorted = useMemo(
    () =>
      [...todaySales].sort((a, b) =>
        b.transactionDate.localeCompare(a.transactionDate),
      ),
    [todaySales],
  );

  const activeSales = useMemo(
    () => todaySales.filter((s) => !s.pendingDelete),
    [todaySales],
  );

  const typeCards = useMemo(() => {
    const salesByType: Record<string, number> = {};
    for (const s of activeSales) {
      const key = s.type ?? "Uncategorized";
      salesByType[key] = (salesByType[key] ?? 0) + s.total;
    }

    const expensesByType: Record<string, number> = {};
    for (const expense of expensesToday) {
      const key = expense.sourceTypeDescription ?? "Uncategorized";
      expensesByType[key] = (expensesByType[key] ?? 0) + expense.amount;
    }

    const keys = new Set([
      ...itemTypes.map((itemType) => itemType.description),
      ...Object.keys(salesByType),
      ...Object.keys(expensesByType),
    ]);

    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({
        type,
        salesTotal: salesByType[type] ?? 0,
        expenseTotal: expensesByType[type] ?? 0,
      }));
  }, [activeSales, expensesToday, itemTypes]);

  const grandTotal = useMemo(
    () => activeSales.reduce((sum, s) => sum + s.total, 0),
    [activeSales],
  );

  const [activeType, setActiveType] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleToday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaleToday | null>(null);
  const markSaleForDeletion = useMarkSaleForDeletion();
  const undoSaleDeletion = useUndoSaleDeletion();
  const removeSalesByIds = useStore((s) => s.removeSalesByIds);
  const { showSnackbar } = useSnackbar();

  const dueRecurringExpenses = useDueRecurringExpenses();
  const saveRecurringExpenseMutation = useSaveRecurringExpense();
  const [skipTarget, setSkipTarget] = useState<RecurringExpense | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleLogRecurring = useCallback(
    (template: RecurringExpense) => {
      setNotificationsOpen(false);
      safePush(
        `/components/expenses/expenses?logRecurringId=${template.id}` as any,
      );
    },
    [safePush],
  );

  const handleSkipConfirm = useCallback(() => {
    if (!skipTarget) return;
    const target = skipTarget;
    setSkipTarget(null);
    saveRecurringExpenseMutation.mutate(
      {
        ...target,
        nextDueDate: advanceDueDate(target.nextDueDate, target.frequency),
      },
      {
        onError: (error) => showSnackbar(error.message, "error"),
      },
    );
  }, [skipTarget, saveRecurringExpenseMutation, showSnackbar]);

  const handleRowPress = useCallback((item: SaleToday) => {
    setSelectedSale(item);
  }, []);

  const handleDeleteFromSheet = useCallback(() => {
    setDeleteTarget(selectedSale);
    setSelectedSale(null);
  }, [selectedSale]);

  const handleUndoFromSheet = useCallback(() => {
    if (!selectedSale) return;
    undoSaleDeletion(selectedSale.id);
    setSelectedSale(null);
  }, [selectedSale, undoSaleDeletion]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    markSaleForDeletion(target.id);

    // Try to delete from the server right away instead of only waiting for
    // a later reconnect/manual-sync event — otherwise, on a continuously
    // online device, the row stays live in Supabase indefinitely even
    // though it's gone from this device's totals.
    if (target.id > 0) {
      try {
        await syncPendingDeletions([target.id]);
        removeSalesByIds([target.id]);
      } catch {
        // Leave the pendingDelete flag set — it'll be picked up by the next
        // reconnect or manual "Sync Data" instead.
        showSnackbar(
          "Deleted locally — will sync to the server on next connection.",
          "info",
        );
      }
    }
  }, [deleteTarget, markSaleForDeletion, removeSalesByIds, showSnackbar]);

  const displayedSales = useMemo(
    () =>
      activeType
        ? sorted.filter((s) => (s.type ?? "Uncategorized") === activeType)
        : sorted,
    [sorted, activeType],
  );

  const renderItem = useCallback(
    ({ item }: { item: SaleToday }) => (
      <SaleTodayRow item={item} onPress={handleRowPress} />
    ),
    [handleRowPress],
  );

  return (
    <View className="flex-1 bg-white">
      {/* Static header */}
      <View className="pt-12">
        <View className="flex-row items-center px-4 mt-4">
          <View className="w-10" />
          <RNText className="flex-1 text-4xl font-bold text-gray-800 text-center">
            RGM Trading
          </RNText>
          <View className="w-10 items-end">
            <IconButton
              icon="bell-outline"
              size={24}
              onPress={() => setNotificationsOpen(true)}
              style={notificationButtonStyle}
            />
            {dueRecurringExpenses.length > 0 && (
              <Badge style={notificationBadgeStyle} size={16}>
                {dueRecurringExpenses.length}
              </Badge>
            )}
          </View>
        </View>

        {/* Grand total */}
        <View className="p-4 items-center">
          <RNText className="text-xs text-gray-500 mb-1 w-full text-center">
            {format(new Date(), "MMMM d, yyyy").toUpperCase()}
          </RNText>
          <RNText className="text-2xl font-bold text-gray-800">
            {formatCurrency(grandTotal)}
          </RNText>
        </View>

        {/* Per-type cards */}
        {typeCards.length > 0 && (
          <View className="px-4 pb-4">
            <View className="flex-row flex-wrap gap-3">
              {typeCards.map(({ type, salesTotal, expenseTotal }, index) => {
                const isSelected = activeType === type;
                const isDimmed = activeType !== null && !isSelected;
                return (
                  <Card
                    key={type}
                    onPress={() =>
                      setActiveType((t) => (t === type ? null : type))
                    }
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor:
                          CARD_COLORS[index % CARD_COLORS.length],
                        opacity: isDimmed ? 0.45 : 1,
                        borderWidth: isSelected ? 2.5 : 0,
                        borderColor: "white",
                      },
                    ]}
                  >
                    <Card.Content className="items-center py-3 px-4">
                      <RNText style={styles.cardTypeLabel}>
                        {isSelected ? "✓  " : ""}
                        {type}
                      </RNText>
                      <RNText style={styles.cardTypeTotal}>
                        {formatCurrency(salesTotal)}
                      </RNText>
                      <RNText style={styles.cardTypeExpense}>
                        Expenses {formatCurrency(expenseTotal)}
                      </RNText>
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        <Divider />
      </View>

      {/* Scrollable list only */}
      <FlatList
        data={displayedSales}
        keyExtractor={(item) => String(item.id)}
        style={{ flex: 1 }}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-200" />}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          !isRefreshing ? (
            <View className="items-center justify-center py-16">
              <Text className="text-gray-400">No sales recorded today</Text>
            </View>
          ) : null
        }
        renderItem={renderItem}
      />

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Sale"
        message={`Delete "${deleteTarget?.name}" — ${deleteTarget ? formatCurrency(deleteTarget.total) : ""}? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={false}
        onConfirm={handleDeleteConfirm}
        onDismiss={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        visible={skipTarget !== null}
        title="Skip This Cycle"
        message={`Skip this occurrence of "${skipTarget?.expenseCategoryName ?? "this recurring expense"}"? No expense will be logged, and it'll move to the next due date.`}
        confirmLabel="Skip"
        isLoading={saveRecurringExpenseMutation.isPending}
        onConfirm={handleSkipConfirm}
        onDismiss={() => setSkipTarget(null)}
      />

      <SaleDetailSheet
        open={selectedSale !== null}
        sale={selectedSale}
        onDelete={handleDeleteFromSheet}
        onUndo={handleUndoFromSheet}
        onDismiss={() => setSelectedSale(null)}
      />

      <NotificationsBottomSheet
        open={notificationsOpen}
        dueRecurringExpenses={dueRecurringExpenses}
        onLog={handleLogRecurring}
        onSkip={(template) => setSkipTarget(template)}
        onDismiss={() => setNotificationsOpen(false)}
      />

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? "close" : "dots-vertical"}
        color="white"
        fabStyle={fabStyles.fab}
        onStateChange={({ open }) => setFabOpen(open)}
        actions={[
          {
            icon: "cash-minus",
            label: "Expenses",
            onPress: () => safePush("/components/expenses/expenses"),
            color: "white",
            style: fabStyles.actionFab,
          },
          {
            icon: "cash-multiple",
            label: "Payables",
            onPress: () => safePush("/components/inventory/payables"),
            color: "white",
            style: fabStyles.actionFab,
          },
          {
            icon: "truck-delivery-outline",
            label: "Deliveries",
            onPress: () => safePush("/components/inventory/delivery"),
            color: "white",
            style: fabStyles.actionFab,
          },
        ]}
      />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  strikethrough: {
    textDecorationLine: "line-through" as const,
    color: "#9ca3af",
  },
});

const useFabStyles = (colors: ReturnType<typeof useAppTheme>["colors"]) =>
  StyleSheet.create({
    fab: {
      borderRadius: 28,
      backgroundColor: colors.primary,
    },
    actionFab: {
      borderRadius: 28,
      backgroundColor: colors.primary,
    },
  });

const notificationButtonStyle = { margin: 0 };
const notificationBadgeStyle = {
  position: "absolute" as const,
  top: 4,
  right: 4,
};

const styles = StyleSheet.create({
  typeCard: {
    minWidth: 120,
    flex: 1,
  },
  cardTypeLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  cardTypeTotal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  cardTypeExpense: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
});
