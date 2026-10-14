import { useAppTheme } from "@/hooks/useAppTheme";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";

type FormValues = {
  name: string;
  isOpex: boolean;
};

type ExpenseCategoryDetailsBottomSheetProps = {
  open: boolean;
  item: ExpenseCategory | null;
  isAddMode: boolean;
  isLoading?: boolean;
  onSave: (name: string, isOpex: boolean) => void;
  onDismiss: () => void;
};

export default function ExpenseCategoryDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  onSave,
  onDismiss,
}: ExpenseCategoryDetailsBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);

  const {
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { isValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      name: "",
      isOpex: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: item?.name ?? "",
        isOpex: item?.isOpex ?? false,
      });
      trigger();
    }
  }, [open, item]);

  useEffect(() => {
    if (open) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  const snapPoints = useMemo(() => ["50%"], []);

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
    onSave(data.name.trim(), data.isOpex);
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
        <Controller
          control={control}
          name="name"
          rules={{
            validate: (v) => v.trim().length > 0 || "Category name is required",
          }}
          render={({
            field: { value, onChange, onBlur },
            fieldState: { error },
          }) => (
            <TextInput
              label="Category Name"
              value={value || " "}
              onChangeText={(text) => onChange(text.replace(/^ /, ""))}
              onBlur={onBlur}
              mode="outlined"
              error={!!error}
            />
          )}
        />

        <Controller
          control={control}
          name="isOpex"
          render={({ field: { value, onChange } }) => (
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <Text variant="bodyMedium" style={styles.toggleLabel}>
                  Counts as operating expense
                </Text>
                <Text variant="bodySmall" style={styles.toggleHint}>
                  Rent, salaries, utilities — shown separately from other
                  cash-outs and included in profitability reports.
                </Text>
              </View>
              <Switch value={value} onValueChange={onChange} />
            </View>
          )}
        />

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isLoading}
            loading={isLoading}
          >
            {isAddMode ? "Add Category" : "Save Changes"}
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
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      paddingHorizontal: 4,
      gap: 12,
    },
    toggleTextCol: {
      flex: 1,
    },
    toggleLabel: {
      color: colors.onBackground,
    },
    toggleHint: {
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    footer: {
      marginTop: 24,
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
  });
