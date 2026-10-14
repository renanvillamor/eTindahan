import OptionSelectSheet, {
  SelectOption,
} from "@/app/components/shared/OptionSelectSheet";
import PaymentMethodsSection, {
  isCashMode,
  usePaymentEntries,
  type PaymentEntry,
} from "@/app/components/shared/PaymentMethodsSection";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { ItemType } from "@/models/ItemType";
import { Payable } from "@/models/Payable";
import { PaymentMode } from "@/models/PaymentMode";
import { Supplier } from "@/models/Supplier";
import {
  CashExpenseInput,
  PaymentMethodInput,
} from "@/services/useSaveDelivery";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Divider, Text, TextInput } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

type FormValues = {
  payeeId: number | null;
  payeeName: string;
  reference: string;
  amount: string;
  dueDate: string;
  remarks: string;
  paidDate: string;
};

type PayableDetailsBottomSheetProps = {
  open: boolean;
  item: Payable | null;
  isAddMode: boolean;
  isLoading?: boolean;
  suppliers: Supplier[];
  itemTypes: ItemType[];
  paymentModes: PaymentMode[];
  onSave: (
    payable: Payable,
    paymentMethods: PaymentMethodInput[],
    cashExpenses: CashExpenseInput[],
  ) => void;
  onDismiss: () => void;
};

function parseDateInput(value: string): string | null {
  if (!value.trim()) return null;
  // Accept YYYY-MM-DD
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const dt = parseISO(value);
    return isValid(dt) ? value : null;
  }
  return null;
}

function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const dt = parseISO(iso.slice(0, 10));
    return isValid(dt) ? format(dt, "yyyy-MM-dd") : "";
  } catch {
    return "";
  }
}

function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function formatHistoryDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const dt = parseISO(iso.slice(0, 10));
    return isValid(dt) ? format(dt, "MMM d, yyyy") : "—";
  } catch {
    return "—";
  }
}

export default function PayableDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  suppliers,
  itemTypes,
  paymentModes,
  onSave,
  onDismiss,
}: PayableDetailsBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);
  const [paidDatePickerOpen, setPaidDatePickerOpen] = useState(false);
  const {
    entries: paymentEntries,
    totalAmount: totalPaymentAmount,
    addEntry,
    updateEntry,
    removeEntry,
    resetEntries,
  } = usePaymentEntries();

  const {
    control,
    handleSubmit,
    reset,
    trigger,
    setValue,
    watch,
    formState: { isValid: formIsValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      payeeId: null,
      payeeName: "",
      reference: "",
      amount: "",
      dueDate: "",
      remarks: "",
      paidDate: "",
    },
  });

  const supplierOptions = useMemo<SelectOption[]>(
    () => [
      { id: -1, label: "— None —" },
      ...suppliers.map((s) => ({ id: s.id, label: s.name })),
    ],
    [suppliers],
  );

  useEffect(() => {
    if (open) {
      const payeeName =
        item?.payeeId != null
          ? (suppliers.find((s) => s.id === item.payeeId)?.name ?? "")
          : "";
      const initialPaidDate = isAddMode
        ? formatDateDisplay(item?.paidDate)
        : formatDateDisplay(item?.paidDate) || getTodayDateString();

      reset({
        payeeId: item?.payeeId ?? null,
        payeeName,
        reference: item?.reference ?? "",
        amount: item?.amount != null ? String(item.amount) : "",
        dueDate: formatDateDisplay(item?.dueDate),
        remarks: item?.remarks ?? "",
        paidDate: initialPaidDate,
      });
      trigger();
      if (!isAddMode) {
        const defaultMode =
          paymentModes.find((m) => m.isDefault) ?? paymentModes[0] ?? null;
        const becomingCash = defaultMode ? isCashMode(defaultMode.mode) : false;
        const outstanding = Math.max(
          0,
          (item?.amount ?? 0) - (item?.amountPaid ?? 0),
        );
        const amt = outstanding > 0 ? String(outstanding) : "";
        resetEntries([
          {
            entryId: `${Date.now()}-init`,
            paymentModeId: defaultMode?.id ?? null,
            amount: amt,
            sourceDate: becomingCash ? format(new Date(), "yyyy-MM-dd") : "",
            sourceTypeId: null,
            remarks: "",
          },
        ]);
      } else {
        resetEntries([]);
      }
    }
  }, [isAddMode, item, open, paymentModes, reset, suppliers, trigger]);

  useEffect(() => {
    if (open) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  const snapPoints = useMemo(
    () => (isAddMode ? ["75%"] : ["88%"]),
    [isAddMode],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={isLoading ? "none" : "close"}
      />
    ),
    [isLoading],
  );

  const payableTotal = item?.amount ?? 0;
  const alreadyPaid = item?.amountPaid ?? 0;
  const outstandingBeforePayment = Math.max(0, payableTotal - alreadyPaid);
  const remaining = outstandingBeforePayment - totalPaymentAmount;
  const hasNoPaymentEntered = !isAddMode && totalPaymentAmount <= 0.001;
  const hasOverpayment = !isAddMode && remaining < -0.001;
  const paymentHistory = item?.payments ?? [];

  const handleUpdateEntry = useCallback(
    (updated: PaymentEntry) => {
      updateEntry(updated);
    },
    [updateEntry],
  );

  const handleRemoveEntry = useCallback(
    (entryId: string) => {
      removeEntry(entryId);
    },
    [removeEntry],
  );

  const onSubmit = (data: FormValues) => {
    const parsedAmount = parseFloat(data.amount.replace(/[^0-9.]/g, ""));
    const paidDate = isAddMode
      ? parseDateInput(data.paidDate)
      : (parseDateInput(data.paidDate) ?? getTodayDateString());

    const validEntries = isAddMode
      ? []
      : paymentEntries.filter((e) => {
          const amt = parseFloat(e.amount);
          return Number.isFinite(amt) && amt > 0;
        });

    const paymentMethodsInput: PaymentMethodInput[] = validEntries.map(
      (entry) => ({
        paymentModeId: entry.paymentModeId,
        amount: parseFloat(entry.amount),
        // Non-cash entries have no date input of their own — fall back to
        // this round's Payment Date so every payable_payment row still gets
        // a real date to be aggregated against in reports.
        sourceDate: entry.sourceDate || paidDate,
        sourceTypeId: entry.sourceTypeId,
        remarks: entry.remarks.trim() || null,
      }),
    );

    const cashExpensesInput: CashExpenseInput[] = validEntries
      .filter((entry) => {
        const mode = paymentModes.find((m) => m.id === entry.paymentModeId);
        return mode && isCashMode(mode.mode);
      })
      .map((entry) => ({
        payeeId: item?.payeeId ?? null,
        sourceDate: entry.sourceDate || null,
        sourceTypeId: entry.sourceTypeId,
        amount: parseFloat(entry.amount),
        remarks: entry.remarks.trim() || null,
      }));

    onSave(
      {
        id: item?.id ?? 0,
        payeeId: data.payeeId,
        payeeName: data.payeeName || null,
        reference: data.reference.trim() || null,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        dueDate: parseDateInput(data.dueDate),
        remarks: data.remarks.trim() || null,
        paidDate,
      },
      paymentMethodsInput,
      cashExpensesInput,
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={!isLoading}
      enableHandlePanningGesture={!isLoading}
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      onChange={(index) => {
        if (index === -1) onDismiss();
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {isAddMode ? "Add Payable" : "Record Payment"}
        </Text>

        {isAddMode ? (
          <>
            {/* Payee (Supplier) picker */}
            <Controller
              control={control}
              name="payeeId"
              render={({ field: { onChange } }) => (
                <OptionSelectSheet
                  label="Payee (Supplier)"
                  value={watch("payeeName")}
                  options={supplierOptions}
                  onSelect={(opt: SelectOption) => {
                    if (opt.id === -1) {
                      onChange(null);
                      setValue("payeeName", "", { shouldValidate: true });
                    } else {
                      onChange(opt.id);
                      setValue("payeeName", opt.label, {
                        shouldValidate: true,
                      });
                    }
                  }}
                />
              )}
            />

            {/* Reference */}
            <Controller
              control={control}
              name="reference"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  label="Reference"
                  value={value || " "}
                  onChangeText={(t) => onChange(t.replace(/^ /, ""))}
                  onBlur={onBlur}
                  mode="outlined"
                  style={styles.field}
                />
              )}
            />

            {/* Amount */}
            <Controller
              control={control}
              name="amount"
              rules={{
                validate: (v) => {
                  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
                  return (Number.isFinite(n) && n > 0) || "Amount must be > 0";
                },
              }}
              render={({
                field: { value, onChange, onBlur },
                fieldState: { error },
              }) => (
                <TextInput
                  label="Amount"
                  value={value || " "}
                  onChangeText={(t) => onChange(t.replace(/^ /, ""))}
                  onBlur={onBlur}
                  mode="outlined"
                  keyboardType="numeric"
                  error={!!error}
                  style={styles.field}
                />
              )}
            />

            {/* Due Date – date picker */}
            <Controller
              control={control}
              name="dueDate"
              render={({ field: { value, onChange } }) => (
                <>
                  <TouchableOpacity
                    onPress={() => setDueDatePickerOpen(true)}
                    activeOpacity={0.7}
                    style={styles.field}
                  >
                    <TextInput
                      label="Due Date"
                      value={value || " "}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      right={
                        <TextInput.Icon
                          icon="calendar"
                          onPress={() => setDueDatePickerOpen(true)}
                        />
                      }
                    />
                  </TouchableOpacity>
                  <DatePickerModal
                    locale="en"
                    mode="single"
                    visible={dueDatePickerOpen}
                    onDismiss={() => setDueDatePickerOpen(false)}
                    date={value ? parseISO(value) : undefined}
                    onConfirm={({ date }: { date: Date | undefined }) => {
                      setDueDatePickerOpen(false);
                      if (date && isValid(date)) {
                        onChange(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    uppercase={false}
                  />
                </>
              )}
            />

            {/* Remarks */}
            <Controller
              control={control}
              name="remarks"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  label="Remarks"
                  value={value || " "}
                  onChangeText={(t) => onChange(t.replace(/^ /, ""))}
                  onBlur={onBlur}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  style={styles.field}
                />
              )}
            />
          </>
        ) : (
          <>
            {/* Amount summary */}
            <View style={styles.field}>
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-500">Total Amount</Text>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.onSurface }}
                >
                  {formatCurrency(payableTotal)}
                </Text>
              </View>
              {alreadyPaid > 0 && (
                <View className="flex-row justify-between mt-1">
                  <Text className="text-sm text-gray-500">Already Paid</Text>
                  <Text className="text-sm font-semibold text-green-600">
                    {formatCurrency(alreadyPaid)}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between mt-1">
                <Text className="text-sm text-gray-500">Balance Due</Text>
                <Text
                  className="text-sm font-bold"
                  style={{ color: colors.primary }}
                >
                  {formatCurrency(outstandingBeforePayment)}
                </Text>
              </View>
            </View>

            {/* Payment History */}
            {paymentHistory.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.sectionLabel}>Payment History</Text>
                {paymentHistory.map((p) => (
                  <View key={p.id} className="flex-row justify-between py-1">
                    <Text className="text-xs text-gray-500">
                      {formatHistoryDate(p.sourceDate)} ·{" "}
                      {p.paymentModeName ?? "—"}
                    </Text>
                    <Text className="text-xs font-medium text-gray-700">
                      {formatCurrency(p.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Payment Date */}
            <Controller
              control={control}
              name="paidDate"
              render={({ field: { value, onChange } }) => (
                <>
                  <TouchableOpacity
                    onPress={() => setPaidDatePickerOpen(true)}
                    activeOpacity={0.7}
                    style={styles.field}
                  >
                    <TextInput
                      label="Payment Date"
                      value={value || " "}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      right={
                        <TextInput.Icon
                          icon="calendar"
                          onPress={() => setPaidDatePickerOpen(true)}
                        />
                      }
                    />
                  </TouchableOpacity>
                  <DatePickerModal
                    locale="en"
                    mode="single"
                    visible={paidDatePickerOpen}
                    onDismiss={() => setPaidDatePickerOpen(false)}
                    date={value ? parseISO(value) : undefined}
                    onConfirm={({ date }: { date: Date | undefined }) => {
                      setPaidDatePickerOpen(false);
                      if (date && isValid(date)) {
                        onChange(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    uppercase={false}
                  />
                </>
              )}
            />

            {/* Payment Methods */}
            <Divider style={styles.field} />
            <Text style={[styles.sectionLabel, styles.field]}>
              Payment Methods
            </Text>
            <PaymentMethodsSection
              entries={paymentEntries}
              paymentModes={paymentModes}
              itemTypes={itemTypes}
              remaining={remaining}
              onAdd={() => addEntry(remaining)}
              onUpdate={handleUpdateEntry}
              onRemove={handleRemoveEntry}
            />

            {/* Remarks */}
            <Controller
              control={control}
              name="remarks"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  label="Remarks"
                  value={value || " "}
                  onChangeText={(t) => onChange(t.replace(/^ /, ""))}
                  onBlur={onBlur}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  style={styles.field}
                />
              )}
            />
          </>
        )}

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            disabled={
              !formIsValid || hasNoPaymentEntered || hasOverpayment || isLoading
            }
            loading={isLoading}
          >
            {isAddMode
              ? "Add Payable"
              : hasNoPaymentEntered
                ? "Enter Payment Amount"
                : hasOverpayment
                  ? `Overpaid by ${formatCurrency(Math.abs(remaining))}`
                  : remaining > 0.001
                    ? `Record Payment (Balance ${formatCurrency(remaining)})`
                    : "Settle Payable"}
          </Button>
          <Button
            mode="outlined"
            onPress={onDismiss}
            disabled={isLoading}
            style={styles.cancelButton}
          >
            Cancel
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
    content: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
      color: colors.onSurface,
    },
    field: {
      marginTop: 8,
    },
    footer: {
      marginTop: 24,
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.onSurface,
      marginBottom: 4,
    },
    addMethodBtn: {
      marginTop: 4,
      marginBottom: 4,
    },
  });
