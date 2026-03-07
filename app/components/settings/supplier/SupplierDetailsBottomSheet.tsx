import { useAppTheme } from "@/hooks/useAppTheme";
import { Supplier } from "@/models/Supplier";
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
  contactNo: string;
};

type SupplierDetailsBottomSheetProps = {
  open: boolean;
  item: Supplier | null;
  isAddMode: boolean;
  isLoading?: boolean;
  onSave: (supplier: Supplier) => void;
  onDismiss: () => void;
};

export default function SupplierDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  onSave,
  onDismiss,
}: SupplierDetailsBottomSheetProps) {
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
    defaultValues: { name: "", description: "", contactNo: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: item?.name ?? "",
        description: item?.description ?? "",
        contactNo: item?.contactNo ?? "",
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
    onSave({
      id: item?.id ?? 0,
      name: data.name.trim(),
      description: data.description.trim() || null,
      contactNo: data.contactNo.trim() || null,
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
        <Controller
          control={control}
          name="name"
          rules={{ validate: (v) => v.trim().length > 0 || "Name is required" }}
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
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="Description"
              value={value || " "}
              onChangeText={(text) => onChange(text.replace(/^ /, ""))}
              onBlur={onBlur}
              mode="outlined"
              style={styles.field}
            />
          )}
        />

        <Controller
          control={control}
          name="contactNo"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="Contact No."
              value={value || " "}
              onChangeText={(text) => onChange(text.replace(/^ /, ""))}
              onBlur={onBlur}
              mode="outlined"
              keyboardType="phone-pad"
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
            {isAddMode ? "Add Supplier" : "Save Changes"}
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
