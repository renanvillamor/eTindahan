import OptionSelectSheet, {
  SelectOption,
} from "@/app/components/shared/OptionSelectSheet";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Expense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Supplier } from "@/models/Supplier";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

type FormValues = {
  payeeId: number | null;
  payeeName: string;
  sourceDate: string;
  expenseCategoryId: number | null;
  expenseCategoryName: string;
  hasCoveragePeriod: boolean;
  coverageStartDate: string;
  coverageEndDate: string;
  amount: string;
  remarks: string;
};

type ExpenseDetailsBottomSheetProps = {
  open: boolean;
  item: Expense | null;
  isAddMode: boolean;
  isLoading?: boolean;
  suppliers: Supplier[];
  expenseCategories: ExpenseCategory[];
  onSave: (expense: Expense) => void;
  onDismiss: () => void;
};

function parseDateInput(value: string): string | null {
  if (!value.trim()) return null;
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

export default function ExpenseDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  suppliers,
  expenseCategories,
  onSave,
  onDismiss,
}: ExpenseDetailsBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);
  const [sourceDatePickerOpen, setSourceDatePickerOpen] = useState(false);
  const [coverageStartPickerOpen, setCoverageStartPickerOpen] =
    useState(false);
  const [coverageEndPickerOpen, setCoverageEndPickerOpen] = useState(false);

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
      sourceDate: "",
      expenseCategoryId: null,
      expenseCategoryName: "",
      hasCoveragePeriod: false,
      coverageStartDate: "",
      coverageEndDate: "",
      amount: "",
      remarks: "",
    },
  });

  const supplierOptions = useMemo<SelectOption[]>(
    () => [
      { id: -1, label: "— None —" },
      ...suppliers.map((s) => ({ id: s.id, label: s.name })),
    ],
    [suppliers],
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () => [
      { id: -1, label: "— None —" },
      ...expenseCategories.map((c) => ({ id: c.id, label: c.name })),
    ],
    [expenseCategories],
  );

  const selectedCategoryId = watch("expenseCategoryId");
  const selectedCategoryIsOpex = useMemo(
    () =>
      expenseCategories.find((c) => c.id === selectedCategoryId)?.isOpex ??
      false,
    [expenseCategories, selectedCategoryId],
  );

  useEffect(() => {
    if (open) {
      const payeeName =
        item?.payeeId != null
          ? (suppliers.find((s) => s.id === item.payeeId)?.name ?? "")
          : "";
      const category = expenseCategories.find(
        (c) => c.id === item?.expenseCategoryId,
      );

      reset({
        payeeId: item?.payeeId ?? null,
        payeeName,
        sourceDate:
          formatDateDisplay(item?.sourceDate) ||
          (isAddMode ? getTodayDateString() : ""),
        expenseCategoryId: item?.expenseCategoryId ?? null,
        expenseCategoryName: category?.name ?? item?.expenseCategoryName ?? "",
        hasCoveragePeriod: !!(item?.coverageStartDate && item?.coverageEndDate),
        coverageStartDate: formatDateDisplay(item?.coverageStartDate),
        coverageEndDate: formatDateDisplay(item?.coverageEndDate),
        amount:
          item?.amount != null && item.amount > 0 ? String(item.amount) : "",
        remarks: item?.remarks ?? "",
      });
      trigger();
    }
  }, [isAddMode, item, open, reset, suppliers, expenseCategories, trigger]);

  useEffect(() => {
    if (open) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  const snapPoints = useMemo(() => ["75%"], []);

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

  const onSubmit = (data: FormValues) => {
    const parsedAmount = parseFloat(data.amount.replace(/[^0-9.]/g, ""));
    const useCoverage = data.hasCoveragePeriod && selectedCategoryIsOpex;
    onSave({
      id: item?.id ?? 0,
      createdAt: item?.createdAt ?? null,
      payeeId: data.payeeId,
      payeeName: data.payeeName || null,
      sourceDate: parseDateInput(data.sourceDate),
      expenseCategoryId: data.expenseCategoryId,
      expenseCategoryName: data.expenseCategoryName || null,
      coverageStartDate: useCoverage
        ? parseDateInput(data.coverageStartDate)
        : null,
      coverageEndDate: useCoverage
        ? parseDateInput(data.coverageEndDate)
        : null,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      remarks: data.remarks.trim() || null,
    });
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
          {isAddMode ? "Add Expense" : "Edit Expense"}
        </Text>

        {/* Payee (Supplier) picker */}
        <View style={styles.field}>
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
                    setValue("payeeName", opt.label, { shouldValidate: true });
                  }
                }}
              />
            )}
          />
        </View>

        {/* Source Date (Paid From) */}
        <Controller
          control={control}
          name="sourceDate"
          render={({ field: { value, onChange } }) => (
            <>
              <TouchableOpacity
                onPress={() => setSourceDatePickerOpen(true)}
                activeOpacity={0.7}
                style={styles.field}
              >
                <TextInput
                  label="Paid From (Date)"
                  value={value || " "}
                  mode="outlined"
                  editable={false}
                  pointerEvents="none"
                  right={
                    <TextInput.Icon
                      icon="calendar"
                      onPress={() => setSourceDatePickerOpen(true)}
                    />
                  }
                />
              </TouchableOpacity>
              <DatePickerModal
                locale="en"
                mode="single"
                visible={sourceDatePickerOpen}
                onDismiss={() => setSourceDatePickerOpen(false)}
                date={value ? parseISO(value) : undefined}
                onConfirm={({ date }: { date: Date | undefined }) => {
                  setSourceDatePickerOpen(false);
                  if (date && isValid(date)) {
                    onChange(format(date, "yyyy-MM-dd"));
                  }
                }}
                uppercase={false}
              />
            </>
          )}
        />

        <View style={styles.field}>
          <Controller
            control={control}
            name="expenseCategoryId"
            render={({ field: { onChange } }) => (
              <OptionSelectSheet
                label="Category"
                value={watch("expenseCategoryName")}
                options={categoryOptions}
                onSelect={(opt: SelectOption) => {
                  if (opt.id === -1) {
                    onChange(null);
                    setValue("expenseCategoryName", "", {
                      shouldValidate: true,
                    });
                  } else {
                    onChange(opt.id);
                    setValue("expenseCategoryName", opt.label, {
                      shouldValidate: true,
                    });
                  }
                  // Coverage period only applies to opex categories — clear
                  // it if the newly selected category isn't one.
                  const nowOpex =
                    expenseCategories.find((c) => c.id === opt.id)?.isOpex ??
                    false;
                  if (!nowOpex) {
                    setValue("hasCoveragePeriod", false);
                  }
                }}
              />
            )}
          />
        </View>

        {/* Coverage period — opex categories only (e.g. a month's rent).
            When set, the amount is amortized across these days in the
            Profit & Loss report instead of hitting one day at full value. */}
        {selectedCategoryIsOpex && (
          <View style={styles.field}>
            <Controller
              control={control}
              name="hasCoveragePeriod"
              render={({ field: { value, onChange } }) => (
                <View style={styles.toggleRow}>
                  <Text variant="bodyMedium" style={styles.toggleLabel}>
                    This covers a period (e.g. a month's rent)
                  </Text>
                  <Switch value={value} onValueChange={onChange} />
                </View>
              )}
            />

            {watch("hasCoveragePeriod") && (
              <View style={styles.coverageRow}>
                <View style={styles.coverageCol}>
                  <Controller
                    control={control}
                    name="coverageStartDate"
                    rules={{
                      validate: (v) =>
                        !watch("hasCoveragePeriod") ||
                        v.trim().length > 0 ||
                        "Required",
                    }}
                    render={({ field: { value } }) => (
                      <TouchableOpacity
                        onPress={() => setCoverageStartPickerOpen(true)}
                        activeOpacity={0.7}
                      >
                        <TextInput
                          label="Covers From"
                          value={value || " "}
                          mode="outlined"
                          editable={false}
                          pointerEvents="none"
                          right={
                            <TextInput.Icon
                              icon="calendar"
                              onPress={() => setCoverageStartPickerOpen(true)}
                            />
                          }
                        />
                      </TouchableOpacity>
                    )}
                  />
                </View>
                <View style={styles.coverageCol}>
                  <Controller
                    control={control}
                    name="coverageEndDate"
                    rules={{
                      validate: (v) =>
                        !watch("hasCoveragePeriod") ||
                        v.trim().length > 0 ||
                        "Required",
                    }}
                    render={({ field: { value } }) => (
                      <TouchableOpacity
                        onPress={() => setCoverageEndPickerOpen(true)}
                        activeOpacity={0.7}
                      >
                        <TextInput
                          label="Covers To"
                          value={value || " "}
                          mode="outlined"
                          editable={false}
                          pointerEvents="none"
                          right={
                            <TextInput.Icon
                              icon="calendar"
                              onPress={() => setCoverageEndPickerOpen(true)}
                            />
                          }
                        />
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            )}

            <DatePickerModal
              locale="en"
              mode="single"
              visible={coverageStartPickerOpen}
              onDismiss={() => setCoverageStartPickerOpen(false)}
              date={
                watch("coverageStartDate")
                  ? parseISO(watch("coverageStartDate"))
                  : undefined
              }
              onConfirm={({ date }: { date: Date | undefined }) => {
                setCoverageStartPickerOpen(false);
                if (date && isValid(date)) {
                  setValue("coverageStartDate", format(date, "yyyy-MM-dd"), {
                    shouldValidate: true,
                  });
                }
              }}
              uppercase={false}
            />
            <DatePickerModal
              locale="en"
              mode="single"
              visible={coverageEndPickerOpen}
              onDismiss={() => setCoverageEndPickerOpen(false)}
              date={
                watch("coverageEndDate")
                  ? parseISO(watch("coverageEndDate"))
                  : undefined
              }
              onConfirm={({ date }: { date: Date | undefined }) => {
                setCoverageEndPickerOpen(false);
                if (date && isValid(date)) {
                  setValue("coverageEndDate", format(date, "yyyy-MM-dd"), {
                    shouldValidate: true,
                  });
                }
              }}
              uppercase={false}
            />
          </View>
        )}

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

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            disabled={!formIsValid || isLoading}
            loading={isLoading}
          >
            {isAddMode ? "Add Expense" : "Save Changes"}
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
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
    },
    toggleLabel: {
      color: colors.onBackground,
      flex: 1,
      marginRight: 12,
    },
    coverageRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    coverageCol: {
      flex: 1,
    },
    footer: {
      marginTop: 24,
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
  });
