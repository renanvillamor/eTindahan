import ConfirmDialog from "@/app/components/shared/ConfirmDialog";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { formatCurrency } from "@/lib/utils";
import { Payable } from "@/models/Payable";
import { useDeletePayable } from "@/services/useDeletePayable";
import { fetchPayables } from "@/services/useGetPayables";
import {
  CashExpenseInput,
  PaymentMethodInput,
} from "@/services/useSaveDelivery";
import { useSaveExpense } from "@/services/useSaveExpense";
import { useSavePayable } from "@/services/useSavePayable";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { format, isValid, parseISO, startOfDay } from "date-fns";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  Chip,
  Divider,
  FAB,
  IconButton,
  List,
  Switch,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../../store/useStore";
import PayableDetailsBottomSheet from "./PayableDetailsBottomSheet";

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const dt = parseISO(iso.slice(0, 10));
    return isValid(dt) ? format(dt, "MMM d, yyyy") : "—";
  } catch {
    return "—";
  }
}

// Single source of truth for "overdue" — a payable is overdue once its due
// date has fully elapsed (not merely started), so this compares against the
// start of today rather than the current instant. Shared by the row badge
// and the "Overdue Only" filter so the two can't disagree on what overdue
// means, as they previously did (badge used "due date passed", the filter
// used "due within the next 7 days").
function isPayableOverdue(payable: Payable): boolean {
  if (payable.paidDate || !payable.dueDate) return false;
  try {
    const dt = parseISO(payable.dueDate.slice(0, 10));
    return isValid(dt) && dt < startOfDay(new Date());
  } catch {
    return false;
  }
}

function PayableRow({
  item,
  onPress,
  onPay,
}: {
  item: Payable;
  onPress: (item: Payable) => void;
  onPay: (item: Payable) => void;
}) {
  const { colors } = useAppTheme();
  const isPaid = !!item.paidDate;
  const isOverdue = isPayableOverdue(item);
  const amountPaid = item.amountPaid ?? 0;
  const balance = Math.max(0, (item.amount ?? 0) - amountPaid);
  const isPartiallyPaid = !isPaid && amountPaid > 0.001;

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(item)}>
      <View className="mx-4 my-2 bg-white rounded-xl overflow-hidden border border-gray-100">
        {/* Top row: transaction date + amount */}
        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-gray-400">Date:</Text>
            <Text className="text-xs font-semibold text-gray-700">
              {formatDateLabel(item.createdAt)}
            </Text>
          </View>
          <Text
            className="text-base font-bold"
            style={{ color: isPaid ? colors.outline : colors.primary }}
          >
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <Divider />

        {/* Details */}
        <View className="px-4 pt-2 pb-2 gap-1">
          {/* Due date — shown above payee */}
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-gray-400 w-20">Due:</Text>
            <Text
              className="text-xs font-semibold"
              style={{ color: isOverdue ? colors.error : colors.onSurface }}
            >
              {formatDateLabel(item.dueDate)}
              {isOverdue ? " (overdue)" : ""}
            </Text>
          </View>

          {isPartiallyPaid ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-gray-400 w-20">Balance:</Text>
              <Text
                className="text-xs font-semibold"
                style={{ color: colors.primary }}
              >
                {formatCurrency(balance)} of {formatCurrency(item.amount)}
              </Text>
            </View>
          ) : null}

          {item.payeeName ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-gray-400 w-20">Payee:</Text>
              <Text className="text-sm font-medium text-gray-800 flex-1">
                {item.payeeName}
              </Text>
            </View>
          ) : null}

          {item.reference ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-gray-400 w-20">Reference:</Text>
              <Text
                className="text-sm text-gray-700 flex-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.reference}
              </Text>
            </View>
          ) : null}

          {item.remarks ? (
            <View className="flex-row items-start gap-1">
              <Text className="text-xs text-gray-400 w-20">Remarks:</Text>
              <Text className="text-sm text-gray-600 flex-1">
                {item.remarks}
              </Text>
            </View>
          ) : null}

          {isPaid && (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-gray-400 w-20">Paid:</Text>
              <Text className="text-xs font-semibold text-green-600">
                {formatDateLabel(item.paidDate)}
              </Text>
            </View>
          )}
        </View>

        {/* Footer: Pay button (unpaid only) */}
        {!isPaid && (
          <View className="px-3 pb-3 pt-1 border-t border-gray-100">
            <Button
              mode="contained-tonal"
              icon="cash-check"
              onPress={() => onPay(item)}
            >
              Pay
            </Button>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function PayablesScreen() {
  const { colors } = useAppTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const styles = useStyles(colors, bottomInset);
  const { showSnackbar } = useSnackbar();

  const suppliers = useStore((s) => s.suppliers) ?? [];
  const paymentModes = useStore((s) => s.paymentModes) ?? [];
  const itemTypes = useStore((s) => s.itemTypes) ?? [];
  const saveMutation = useSavePayable();
  const saveExpenseMutation = useSaveExpense();
  const deleteMutation = useDeletePayable();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const actionSheetRef = useRef<BottomSheet>(null);
  const [actionTarget, setActionTarget] = useState<Payable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payable | null>(null);

  useEffect(() => {
    if (actionTarget) {
      actionSheetRef.current?.snapToIndex(0);
    } else {
      actionSheetRef.current?.close();
    }
  }, [actionTarget]);

  const syncPayables = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const latestPayables = await fetchPayables();
      setPayables(latestPayables);
    } catch (error) {
      showSnackbar((error as Error).message, "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [setPayables, showSnackbar]);

  useFocusEffect(
    useCallback(() => {
      syncPayables();
    }, [syncPayables]),
  );

  const [editingItem, setEditingItem] = useState<Payable | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(true);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [selectedPayeeId, setSelectedPayeeId] = useState<number | null>(null);

  const payeeOptions = useMemo(() => {
    const seen = new Set<number>();
    const options: { id: number; name: string }[] = [];
    for (const p of payables) {
      if (p.payeeId != null && !seen.has(p.payeeId)) {
        seen.add(p.payeeId);
        options.push({ id: p.payeeId, name: p.payeeName ?? `#${p.payeeId}` });
      }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [payables]);

  const filtered = useMemo(() => {
    let result = payables;
    if (showUnpaidOnly) result = result.filter((p) => !p.paidDate);
    if (showOverdueOnly) result = result.filter(isPayableOverdue);
    if (selectedPayeeId !== null)
      result = result.filter((p) => p.payeeId === selectedPayeeId);
    return result;
  }, [payables, showUnpaidOnly, showOverdueOnly, selectedPayeeId]);

  const totalPending = useMemo(
    () =>
      filtered
        .filter((p) => !p.paidDate)
        .reduce(
          (sum, p) => sum + Math.max(0, (p.amount ?? 0) - (p.amountPaid ?? 0)),
          0,
        ),
    [filtered],
  );

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({
      id: 0,
      amount: 0,
      payeeId: null,
      reference: null,
      dueDate: null,
      remarks: null,
      paidDate: null,
    });
  };

  const handlePay = (item: Payable) => {
    setActionTarget(null);
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: async () => {
        await syncPayables();
        showSnackbar("Payable deleted.", "success");
        setDeleteTarget(null);
      },
      onError: (error) => {
        showSnackbar(error.message, "error");
        setDeleteTarget(null);
      },
    });
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  const handleSave = (
    payable: Payable,
    paymentMethods: PaymentMethodInput[],
    cashExpenses: CashExpenseInput[],
  ) => {
    saveMutation.mutate(
      { payable, paymentMethods },
      {
        onSuccess: async (saved) => {
          // Save cash expenses via useSaveExpense
          for (const e of cashExpenses) {
            await saveExpenseMutation.mutateAsync({
              id: 0,
              payeeId: e.payeeId ?? null,
              sourceDate: e.sourceDate ?? null,
              sourceTypeId: e.sourceTypeId ?? null,
              amount: e.amount,
              remarks: e.remarks ?? null,
            });
          }
          await syncPayables();
          if (!isAddMode && !!saved.paidDate) {
            setShowUnpaidOnly(false);
          }
          showSnackbar(
            isAddMode
              ? "Payable added successfully."
              : !isAddMode && !!saved.paidDate
                ? "Payable settled successfully."
                : "Payment recorded successfully.",
            "success",
          );
          setEditingItem(null);
          setIsAddMode(false);
        },
        onError: (error) => {
          showSnackbar(error.message, "error");
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Payables",
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
        {/* Filter bar */}
        <View className="bg-white border-b border-gray-200">
          <View className="flex-row items-center justify-between px-4 py-3 gap-4">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-medium text-gray-700">
                Unpaid Only
              </Text>
              <Switch
                value={showUnpaidOnly}
                onValueChange={setShowUnpaidOnly}
              />
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-medium text-gray-700">
                Overdue Only
              </Text>
              <Switch
                value={showOverdueOnly}
                onValueChange={setShowOverdueOnly}
              />
            </View>
          </View>
          {payeeOptions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}
              style={styles.chipsScroll}
            >
              {payeeOptions.map((payee) => (
                <Chip
                  key={payee.id}
                  mode="outlined"
                  selected={selectedPayeeId === payee.id}
                  showSelectedCheck={false}
                  onPress={() =>
                    setSelectedPayeeId(
                      selectedPayeeId === payee.id ? null : payee.id,
                    )
                  }
                  style={[
                    styles.chip,
                    selectedPayeeId === payee.id && styles.selectedChip,
                  ]}
                  textStyle={
                    selectedPayeeId === payee.id
                      ? styles.selectedChipText
                      : undefined
                  }
                >
                  {payee.name}
                </Chip>
              ))}
            </ScrollView>
          )}
        </View>

        {filtered.length > 0 ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={syncPayables}
              />
            }
            renderItem={({ item }) => (
              <PayableRow
                item={item}
                onPress={setActionTarget}
                onPay={handlePay}
              />
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400 text-base">No payables found</Text>
          </View>
        )}

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      {/* Bottom total footer */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.surfaceDisabled,
            paddingBottom: 12 + bottomInset,
          },
        ]}
      >
        <View className="flex-1">
          <Text className="text-xs text-gray-500">Total Unpaid</Text>
          <Text className="text-xl font-bold text-gray-800">
            {formatCurrency(totalPending)}
          </Text>
        </View>
      </View>

      <PayableDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        suppliers={suppliers}
        itemTypes={itemTypes}
        paymentModes={paymentModes}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />

      <BottomSheet
        ref={actionSheetRef}
        index={-1}
        snapPoints={["18%"]}
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

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Payable"
        message={`Delete this payable of ${deleteTarget ? formatCurrency(deleteTarget.amount) : ""}? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onDismiss={() => setDeleteTarget(null)}
      />
    </>
  );
}

const useStyles = (colors: any, bottomInset: number) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: 16,
    },
    chipsScroll: {
      paddingBottom: 10,
    },
    chipsContent: {
      paddingHorizontal: 16,
      alignItems: "center" as const,
      gap: 8,
    },
    chip: {
      borderRadius: 16,
      borderColor: colors.surfaceDisabled,
    },
    selectedChip: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    selectedChipText: {
      color: "white",
    },
    fab: {
      position: "absolute",
      right: 16,
      bottom: 16 + bottomInset,
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
