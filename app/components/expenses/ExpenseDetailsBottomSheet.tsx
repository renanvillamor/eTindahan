import OptionSelectSheet, {
  SelectOption,
} from "@/app/components/shared/OptionSelectSheet";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Expense } from "@/models/Expense";
import { ItemType } from "@/models/ItemType";
import { Supplier } from "@/models/Supplier";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

type FormValues = {
  payeeId: number | null;
  payeeName: string;
  sourceDate: string;
  sourceTypeId: number | null;
  sourceTypeDescription: string;
  amount: string;
  remarks: string;
};

type ExpenseDetailsBottomSheetProps = {
  open: boolean;
  item: Expense | null;
  isAddMode: boolean;
  isLoading?: boolean;
  suppliers: Supplier[];
  itemTypes: ItemType[];
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
  itemTypes,
  onSave,
  onDismiss,
}: ExpenseDetailsBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);
  const [sourceDatePickerOpen, setSourceDatePickerOpen] = useState(false);

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
      sourceTypeId: null,
      sourceTypeDescription: "",
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

  const itemTypeOptions = useMemo<SelectOption[]>(
    () => [
      { id: -1, label: "— None —" },
      ...itemTypes.map((type) => ({ id: type.id, label: type.description })),
    ],
    [itemTypes],
  );

  useEffect(() => {
    if (open) {
      const payeeName =
        item?.payeeId != null
          ? (suppliers.find((s) => s.id === item.payeeId)?.name ?? "")
          : "";

      reset({
        payeeId: item?.payeeId ?? null,
        payeeName,
        sourceDate:
          formatDateDisplay(item?.sourceDate) ||
          (isAddMode ? getTodayDateString() : ""),
        sourceTypeId: item?.sourceTypeId ?? null,
        sourceTypeDescription: item?.sourceTypeDescription ?? "",
        amount:
          item?.amount != null && item.amount > 0 ? String(item.amount) : "",
        remarks: item?.remarks ?? "",
      });
      trigger();
    }
  }, [isAddMode, item, open, reset, suppliers, trigger]);

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
      id: item?.id ?? 0,
      createdAt: item?.createdAt ?? null,
      payeeId: data.payeeId,
      payeeName: data.payeeName || null,
      sourceDate: parseDateInput(data.sourceDate),
      sourceTypeId: data.sourceTypeId,
      sourceTypeDescription: data.sourceTypeDescription || null,
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
            name="sourceTypeId"
            render={({ field: { onChange } }) => (
              <OptionSelectSheet
                label="Source Type"
                value={watch("sourceTypeDescription")}
                options={itemTypeOptions}
                onSelect={(opt: SelectOption) => {
                  if (opt.id === -1) {
                    onChange(null);
                    setValue("sourceTypeDescription", "", {
                      shouldValidate: true,
                    });
                  } else {
                    onChange(opt.id);
                    setValue("sourceTypeDescription", opt.label, {
                      shouldValidate: true,
                    });
                  }
                }}
              />
            )}
          />
        </View>

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
    footer: {
      marginTop: 24,
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
  });
