import { useAppTheme } from "@/hooks/useAppTheme";
import { Uom } from "@/models/Uom";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { Button, TextInput } from "react-native-paper";

type FormValues = {
  name: string;
  description: string;
  displayLabel: string;
  packSize: string;
};

type UomDetailsBottomSheetProps = {
  open: boolean;
  item: Uom | null;
  isAddMode: boolean;
  isLoading?: boolean;
  onSave: (
    name: string,
    description: string,
    displayLabel: string,
    packSize: number | null,
  ) => void;
  onDismiss: () => void;
};

export default function UomDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  onSave,
  onDismiss,
}: UomDetailsBottomSheetProps) {
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
      description: "",
      displayLabel: "",
      packSize: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: item?.name ?? "",
        description: item?.description ?? "",
        displayLabel: item?.displayLabel ?? "",
        packSize: item?.packSize != null ? String(item.packSize) : "",
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

  const snapPoints = useMemo(() => ["60%"], []);

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
    const pack = data.packSize?.trim() ? Number(data.packSize) : null;
    onSave(
      data.name.trim(),
      data.description.trim(),
      data.displayLabel.trim(),
      pack,
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
        <Controller
          control={control}
          name="name"
          rules={{
            validate: (v) => v.trim().length > 0 || "Name is required",
          }}
          render={({
            field: { value, onChange, onBlur },
            fieldState: { error },
          }) => (
            <>
              <TextInput
                label="Name"
                value={value || " "}
                onChangeText={(text) => onChange(text.replace(/^ /, ""))}
                onBlur={onBlur}
                mode="outlined"
                error={!!error}
              />
            </>
          )}
        />

        <Controller
          control={control}
          name="description"
          rules={{
            validate: (v) => v.trim().length > 0 || "Description is required",
          }}
          render={({
            field: { value, onChange, onBlur },
            fieldState: { error },
          }) => (
            <TextInput
              label="Description"
              value={value || " "}
              onChangeText={(text) => onChange(text.replace(/^ /, ""))}
              onBlur={onBlur}
              mode="outlined"
              error={!!error}
              style={styles.field}
            />
          )}
        />

        <Controller
          control={control}
          name="displayLabel"
          render={({ field: { value, onChange } }) => (
            <TextInput
              label="Display Label"
              value={value || ""}
              onChangeText={(text) => onChange(text)}
              mode="outlined"
              style={styles.field}
            />
          )}
        />

        <Controller
          control={control}
          name="packSize"
          rules={{
            validate: (v) => v === "" || !isNaN(Number(v)) || "Invalid",
          }}
          render={({ field: { value, onChange } }) => (
            <TextInput
              label="Pack Size (optional)"
              value={value || ""}
              onChangeText={(text) => onChange(text)}
              mode="outlined"
              keyboardType="numeric"
              style={styles.field}
            />
          )}
        />

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isLoading}
            loading={isLoading}
          >
            {isAddMode ? "Add UOM" : "Save Changes"}
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
    footer: {
      marginTop: 24,
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
  });
