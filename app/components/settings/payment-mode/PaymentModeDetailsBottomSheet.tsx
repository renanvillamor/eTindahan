import { useAppTheme } from "@/hooks/useAppTheme";
import { PaymentMode } from "@/models/PaymentMode";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";

type FormValues = {
  mode: string;
  description: string;
  isDefault: boolean;
};

type PaymentModeDetailsBottomSheetProps = {
  open: boolean;
  item: PaymentMode | null;
  isAddMode: boolean;
  isLoading?: boolean;
  onSave: (mode: string, description: string, isDefault: boolean) => void;
  onDismiss: () => void;
};

export default function PaymentModeDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  onSave,
  onDismiss,
}: PaymentModeDetailsBottomSheetProps) {
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
      mode: "",
      description: "",
      isDefault: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        mode: item?.mode ?? "",
        description: item?.description ?? "",
        isDefault: item?.isDefault ?? false,
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

  const snapPoints = useMemo(() => ["55%"], []);

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
    onSave(data.mode.trim(), data.description.trim(), data.isDefault);
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
          name="mode"
          rules={{
            validate: (v) => v.trim().length > 0 || "Mode name is required",
          }}
          render={({
            field: { value, onChange, onBlur },
            fieldState: { error },
          }) => (
            <TextInput
              label="Mode Name"
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
          name="description"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="Description (optional)"
              value={value || ""}
              onChangeText={(text) => onChange(text)}
              onBlur={onBlur}
              mode="outlined"
              style={styles.field}
            />
          )}
        />

        <Controller
          control={control}
          name="isDefault"
          render={({ field: { value, onChange } }) => (
            <View style={styles.toggleRow}>
              <Text variant="bodyMedium" style={styles.toggleLabel}>
                Set as default
              </Text>
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
            {isAddMode ? "Add Mode" : "Save Changes"}
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
    field: {
      marginTop: 8,
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
