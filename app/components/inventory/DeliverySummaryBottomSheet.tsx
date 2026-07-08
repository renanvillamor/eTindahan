import PaymentMethodsSection, {
  PayableConfig,
  getTodayString,
  isBankTransferMode,
  isCashMode,
  newEntryId,
  usePaymentEntries,
} from "@/app/components/shared/PaymentMethodsSection";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { ItemType } from "@/models/ItemType";
import { PaymentMode } from "@/models/PaymentMode";
import {
  CashExpenseInput,
  PayableInput,
  PaymentMethodInput,
} from "@/services/useSaveDelivery";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Button,
  Divider,
  IconButton,
  List,
  Switch,
  TextInput,
} from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

type ItemLike = {
  id: number;
  name?: string | null;
  supplierPrice?: number | null;
  deliveryUom?: string | null;
};

type DeliverySummaryBottomSheetProps = {
  open: boolean;
  isSaving?: boolean;
  supplierName: string | null;
  supplierId: number | null;
  items: ItemLike[];
  qtyByItemId: Record<number, number>;
  itemTypes: ItemType[];
  paymentModes: PaymentMode[];
  onSave: (
    isPaid: boolean,
    dueDate: string | null,
    reference: string | null,
    paymentMethods: PaymentMethodInput[],
    cashExpenses: CashExpenseInput[],
    payables: PayableInput[],
  ) => void;
  onDismiss?: () => void;
};

// ── Payment entry row (moved to shared/PaymentMethodsSection) ────────────────
// ── Main component ─────────────────────────────────────────────────────────────
export default function DeliverySummaryBottomSheet({
  open,
  isSaving = false,
  supplierName,
  supplierId,
  items,
  qtyByItemId,
  itemTypes,
  paymentModes,
  onSave,
  onDismiss,
}: DeliverySummaryBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);

  const [isPaid, setIsPaid] = useState(true);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);
  const {
    entries: paymentEntries,
    totalAmount: totalPaymentAmount,
    addEntry,
    updateEntry,
    removeEntry,
    resetEntries,
  } = usePaymentEntries();
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [payableConfigs, setPayableConfigs] = useState<
    Record<string, PayableConfig>
  >({});

  const selectedItems = useMemo(() => {
    return items.map((it) => {
      const qty = qtyByItemId[it.id] ?? 0;
      const price = Number(it.supplierPrice ?? 0);
      const subtotal = price * Number(qty);
      return { item: it, qty, price, subtotal };
    });
  }, [items, qtyByItemId]);

  const total = useMemo(
    () => selectedItems.reduce((sum, row) => sum + row.subtotal, 0),
    [selectedItems],
  );

  // Reset all state when the sheet opens / closes
  useEffect(() => {
    if (open) {
      setIsPaid(true);
      setDueDate(null);
      setReference("");
      resetEntries([]);
      setPaymentExpanded(false);
      setPayableConfigs({});
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  // Auto-add a default payment entry when switching to paid with no entries
  useEffect(() => {
    if (isPaid && paymentEntries.length === 0 && open) {
      const defaultMode =
        paymentModes.find((m) => m.isDefault) ?? paymentModes[0] ?? null;
      const becomingCash = defaultMode ? isCashMode(defaultMode.mode) : false;
      resetEntries([
        {
          entryId: newEntryId(),
          paymentModeId: defaultMode?.id ?? null,
          amount: total > 0 ? String(total) : "",
          sourceDate: becomingCash ? getTodayString() : "",
          sourceTypeId: null,
          remarks: "",
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaid, open]);

  // Sync bank-transfer payable configs whenever payment entries or modes change
  useEffect(() => {
    setPayableConfigs((prev) => {
      const next: Record<string, PayableConfig> = {};
      for (const entry of paymentEntries) {
        const mode = paymentModes.find((m) => m.id === entry.paymentModeId);
        if (mode && isBankTransferMode(mode.mode)) {
          next[entry.entryId] = prev[entry.entryId] ?? {
            addToPayable: false,
            reference: "Personal",
            amount: entry.amount,
            remarks: `${supplierName ?? ""} - ${format(new Date(), "M/d/yyyy")}`,
          };
        }
      }
      return next;
    });
  }, [paymentEntries, paymentModes, supplierName]);

  const snapPoints = useMemo(
    () => (isPaid && paymentExpanded ? ["92%"] : ["75%"]),
    [isPaid, paymentExpanded],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const dueDateLabel = useMemo(() => {
    if (!dueDate) return " ";
    try {
      const dt = parseISO(dueDate);
      return isValid(dt) ? format(dt, "MMM d, yyyy") : " ";
    } catch {
      return " ";
    }
  }, [dueDate]);

  const remaining = total - totalPaymentAmount;

  // Block completion when Paid is on but payment methods don't fully cover total
  const hasPaymentShortfall = isPaid && remaining > 0.001;

  // Block completion when Paid is off but required fields are missing
  const hasUnpaidFieldsMissing = !isPaid && (!reference.trim() || !dueDate);

  const handleTogglePaid = (v: boolean) => {
    setIsPaid(v);
    if (!v) {
      resetEntries([]);
      setPaymentExpanded(false);
    }
  };

  const handleSave = () => {
    if (isSaving) return;

    const validEntries = isPaid
      ? paymentEntries.filter((e) => {
          const amt = parseFloat(e.amount);
          return Number.isFinite(amt) && amt > 0;
        })
      : [];

    const paymentMethods: PaymentMethodInput[] = validEntries.map((entry) => ({
      paymentModeId: entry.paymentModeId,
      amount: parseFloat(entry.amount),
      sourceDate: entry.sourceDate || null,
      sourceTypeId: entry.sourceTypeId,
      remarks: entry.remarks.trim() || null,
    }));

    const cashExpenses: CashExpenseInput[] = validEntries
      .filter((entry) => {
        const mode = paymentModes.find((m) => m.id === entry.paymentModeId);
        return mode && isCashMode(mode.mode);
      })
      .map((entry) => ({
        payeeId: supplierId,
        sourceDate: entry.sourceDate || null,
        sourceTypeId: entry.sourceTypeId,
        amount: parseFloat(entry.amount),
        remarks: entry.remarks.trim() || null,
      }));

    onSave(
      isPaid,
      dueDate,
      reference || null,
      paymentMethods,
      cashExpenses,
      Object.values(payableConfigs)
        .filter((cfg) => cfg.addToPayable)
        .map((cfg) => ({
          payeeId: supplierId,
          reference: cfg.reference.trim() || null,
          amount: parseFloat(cfg.amount) || 0,
          remarks: cfg.remarks.trim() || null,
        })),
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={true}
      enableHandlePanningGesture={true}
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      onChange={(index) => {
        if (index === -1) onDismiss?.();
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: supplier name + Paid toggle */}
        <View className="flex-row mb-3 items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-sm text-gray-500 mr-2">Supplier:</Text>
            <Text className="font-semibold">
              {supplierName?.toUpperCase() ?? "(none)"}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Text className="text-sm text-gray-500 mr-2">Paid</Text>
            <Switch value={isPaid} onValueChange={handleTogglePaid} />
          </View>
        </View>

        {/* ── Unpaid: reference + due date ─────────────────────────────── */}
        {!isPaid && (
          <>
            <View className="flex-row gap-2 mb-3">
              <View className="flex-1">
                <TextInput
                  label="Reference *"
                  value={reference}
                  onChangeText={setReference}
                  mode="outlined"
                  error={!reference.trim()}
                />
              </View>
              <TouchableOpacity
                onPress={() => setDueDatePickerOpen(true)}
                activeOpacity={0.7}
                className="flex-1"
              >
                <TextInput
                  label="Due Date *"
                  value={dueDateLabel}
                  mode="outlined"
                  editable={false}
                  pointerEvents="none"
                  error={!dueDate}
                  right={
                    <TextInput.Icon
                      icon="calendar"
                      onPress={() => setDueDatePickerOpen(true)}
                    />
                  }
                />
              </TouchableOpacity>
            </View>
            <DatePickerModal
              locale="en"
              mode="single"
              visible={dueDatePickerOpen}
              onDismiss={() => setDueDatePickerOpen(false)}
              date={dueDate ? parseISO(dueDate) : undefined}
              onConfirm={({ date }: { date: Date | undefined }) => {
                setDueDatePickerOpen(false);
                if (date && isValid(date))
                  setDueDate(format(date, "yyyy-MM-dd"));
              }}
              uppercase={false}
            />
          </>
        )}

        <Divider style={styles.divider} />

        {/* ── Items list ───────────────────────────────────────────────── */}
        {selectedItems.map(({ item, qty, price, subtotal }) => (
          <List.Item
            key={item.id}
            title={item.name ?? "Unnamed item"}
            description={() => (
              <Text className="text-sm text-gray-500">
                {`${formatCurrency(price)} x ${qty} ${item.deliveryUom ? item.deliveryUom + "/s" : ""}`}
              </Text>
            )}
            right={() => (
              <Text className="text-sm text-gray-700">
                {formatCurrency(subtotal)}
              </Text>
            )}
            contentStyle={{ marginVertical: 0 }}
          />
        ))}

        {/* ── Total + Complete button ──────────────────────────────────── */}
        <View className="mt-3 pt-3 border-t border-gray-200">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold">TOTAL</Text>
            <Text className="text-base font-semibold">
              {formatCurrency(total)}
            </Text>
          </View>

          {/* ── Paid: payment breakdown ─────────────────────────────── */}
          {isPaid && (
            <View style={[styles.paymentSection, { marginBottom: 16 }]}>
              {/* Collapsible header */}
              <TouchableOpacity
                onPress={() => setPaymentExpanded((v) => !v)}
                activeOpacity={0.7}
                style={styles.paymentHeader}
              >
                <View className="flex-1">
                  <Text style={styles.paymentHeaderTitle}>Payment Methods</Text>
                  {!paymentExpanded && paymentEntries.length > 0 && (
                    <View className="mt-1 gap-0.5">
                      {paymentEntries
                        .filter((entry) => {
                          const amt = parseFloat(entry.amount);
                          return Number.isFinite(amt) && amt > 0;
                        })
                        .map((entry) => {
                          const mode = paymentModes.find(
                            (m) => m.id === entry.paymentModeId,
                          );
                          const amt = parseFloat(entry.amount);
                          return (
                            <View
                              key={entry.entryId}
                              className="flex-row justify-between pr-2"
                            >
                              <Text style={styles.paymentSummaryLabel}>
                                {mode?.mode ?? "—"}
                              </Text>
                              <Text style={styles.paymentSummaryLabel}>
                                {formatCurrency(amt)}
                              </Text>
                            </View>
                          );
                        })}
                      <View className="flex-row justify-between pr-2 mt-0.5">
                        <Text
                          style={[
                            styles.paymentSummaryRemaining,
                            {
                              color: remaining <= 0.001 ? "#16a34a" : "#ef4444",
                            },
                          ]}
                        >
                          Remaining
                        </Text>
                        <Text
                          style={[
                            styles.paymentSummaryRemaining,
                            {
                              color: remaining <= 0.001 ? "#16a34a" : "#ef4444",
                            },
                          ]}
                        >
                          {remaining < -0.001
                            ? `${formatCurrency(Math.abs(remaining))} overpaid`
                            : formatCurrency(Math.max(0, remaining))}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <IconButton
                  icon={paymentExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  style={styles.chevronBtn}
                />
              </TouchableOpacity>

              {/* Expanded content */}
              {paymentExpanded && (
                <View style={styles.paymentBody}>
                  <PaymentMethodsSection
                    entries={paymentEntries}
                    paymentModes={paymentModes}
                    itemTypes={itemTypes}
                    remaining={remaining}
                    onAdd={() => addEntry(remaining)}
                    onUpdate={updateEntry}
                    onRemove={removeEntry}
                    payableConfigs={payableConfigs}
                    onPayableConfigChange={(entryId, cfg) =>
                      setPayableConfigs((prev) => ({
                        ...prev,
                        [entryId]: cfg,
                      }))
                    }
                  />
                </View>
              )}
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSave}
            disabled={hasPaymentShortfall || hasUnpaidFieldsMissing || isSaving}
            loading={isSaving}
          >
            {isSaving
              ? "Saving Delivery..."
              : hasPaymentShortfall
                ? `Remaining ${formatCurrency(remaining)}`
                : "Complete Delivery"}
          </Button>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    sheetBackground: {
      borderTopWidth: 1,
      borderTopColor: colors.surfaceDisabled,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    paymentSection: {
      marginBottom: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      overflow: "hidden",
    },
    paymentHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "#f3f4f6",
    },
    paymentHeaderTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.onSurfaceVariant ?? "#6b7280",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    paymentSummaryPaid: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.onSurface ?? "#111827",
    },
    paymentSummaryLabel: {
      fontSize: 12,
      color: "#374151",
    },
    paymentSummaryRemaining: {
      fontSize: 12,
      fontWeight: "600",
    },
    chevronBtn: {
      margin: 0,
      marginLeft: 4,
    },
    paymentBody: {
      padding: 10,
      backgroundColor: colors.surface,
    },
    addMethodBtn: {
      marginTop: 4,
    },
    divider: {
      marginBottom: 4,
    },
    remainingLabel: {
      fontSize: 12,
      fontWeight: "600",
    },
  });
