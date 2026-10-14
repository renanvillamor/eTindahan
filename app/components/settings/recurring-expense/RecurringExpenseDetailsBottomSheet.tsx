import OptionSelectSheet, {
  SelectOption,
} from "@/app/components/shared/OptionSelectSheet";
import { useAppTheme } from "@/hooks/useAppTheme";
import { FREQUENCY_LABELS } from "@/lib/recurringExpense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import {
  RecurringExpense,
  RecurringFrequency,
} from "@/models/RecurringExpense";
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

const FREQUENCIES: RecurringFrequency[] = ["weekly", "biweekly", "monthly"];

type FormValues = {
  expenseCategoryId: number | null;
  expenseCategoryName: string;
  amount: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  remarks: string;
  isActive: boolean;
};

type RecurringExpenseDetailsBottomSheetProps = {
  open: boolean;
  item: RecurringExpense | null;
  isAddMode: boolean;
  isLoading?: boolean;
  /** Only opex-flagged categories are offered — amortization is opex-only. */
  expenseCategories: ExpenseCategory[];
  onSave: (template: Omit<RecurringExpense, "id">) => void;
  onDismiss: () => void;
};

function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export default function RecurringExpenseDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  expenseCategories,
  onSave,
  onDismiss,
}: RecurringExpenseDetailsBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);

  const opexCategories = useMemo(
    () => expenseCategories.filter((c) => c.isOpex),
    [expenseCategories],
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () => opexCategories.map((c) => ({ id: c.id, label: c.name })),
    [opexCategories],
  );

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
      expenseCategoryId: null,
      expenseCategoryName: "",
      amount: "",
      frequency: "monthly",
      nextDueDate: "",
      remarks: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      const category = opexCategories.find(
        (c) => c.id === item?.expenseCategoryId,
      );
      reset({
        expenseCategoryId: item?.expenseCategoryId ?? null,
        expenseCategoryName: category?.name ?? item?.expenseCategoryName ?? "",
        amount: item?.amount != null && item.amount > 0 ? String(item.amount) : "",
        frequency: item?.frequency ?? "monthly",
        nextDueDate: item?.nextDueDate || getTodayDateString(),
        remarks: item?.remarks ?? "",
        isActive: item?.isActive ?? true,
      });
      trigger();
    }
  }, [open, item, opexCategories, reset, trigger]);

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
    onSave({
      expenseCategoryId: data.expenseCategoryId as number,
      expenseCategoryName: data.expenseCategoryName || null,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
      remarks: data.remarks.trim() || null,
      isActive: data.isActive,
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
          {isAddMode ? "Add Recurring Expense" : "Edit Recurring Expense"}
        </Text>

        {opexCategories.length === 0 ? (
          <Text style={styles.emptyHint}>
            No operating-expense categories yet — add one under Settings →
            Expense Categories first (flag it "Counts as operating
            expense").
          </Text>
        ) : (
          <>
            <View style={styles.field}>
              <Controller
                control={control}
                name="expenseCategoryId"
                rules={{ validate: (v) => v != null || "Category is required" }}
                render={({ field: { onChange }, fieldState: { error } }) => (
                  <OptionSelectSheet
                    label="Category"
                    value={watch("expenseCategoryName")}
                    options={categoryOptions}
                    error={!!error}
                    onSelect={(opt: SelectOption) => {
                      onChange(opt.id);
                      setValue("expenseCategoryName", opt.label, {
                        shouldValidate: true,
                      });
                    }}
                  />
                )}
              />
            </View>

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
                  label="Amount (estimate)"
                  value={value || " "}
                  onChangeText={(t) => onChange(t.replace(/^ /, ""))}
                  onBlur={onBlur}
                  mode="outlined"
                  keyboardType="numeric"
                  error={!!error}
                  style={styles.field}
                  left={<TextInput.Affix text="₱" />}
                />
              )}
            />

            <Text style={[styles.sectionLabel, styles.field]}>Frequency</Text>
            <Controller
              control={control}
              name="frequency"
              render={({ field: { value, onChange } }) => (
                <View style={styles.chipRow}>
                  {FREQUENCIES.map((freq) => {
                    const isSelected = value === freq;
                    return (
                      <TouchableOpacity
                        key={freq}
                        activeOpacity={0.75}
                        onPress={() => onChange(freq)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : colors.secondary,
                            borderColor: isSelected
                              ? colors.primary
                              : colors.outline,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? "#fff" : colors.onSurface },
                          ]}
                        >
                          {FREQUENCY_LABELS[freq]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />

            <Controller
              control={control}
              name="nextDueDate"
              render={({ field: { value, onChange } }) => (
                <>
                  <TouchableOpacity
                    onPress={() => setDueDatePickerOpen(true)}
                    activeOpacity={0.7}
                    style={styles.field}
                  >
                    <TextInput
                      label="Next Due Date"
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

            <Controller
              control={control}
              name="isActive"
              render={({ field: { value, onChange } }) => (
                <View style={styles.toggleRow}>
                  <Text variant="bodyMedium" style={styles.toggleLabel}>
                    Active
                  </Text>
                  <Switch value={value} onValueChange={onChange} />
                </View>
              )}
            />
          </>
        )}

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            disabled={!formIsValid || isLoading || opexCategories.length === 0}
            loading={isLoading}
          >
            {isAddMode ? "Add Template" : "Save Changes"}
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
    emptyHint: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      lineHeight: 18,
    },
    field: {
      marginTop: 8,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.outline,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    chip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 9,
      borderWidth: 1,
      borderRadius: 8,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      paddingHorizontal: 4,
    },
    toggleLabel: {
      color: colors.onBackground,
    },
    footer: {
      marginTop: 24,
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
  });
