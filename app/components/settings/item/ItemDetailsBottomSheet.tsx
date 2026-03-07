import { useAppTheme } from "@/hooks/useAppTheme";
import { Item } from "@/models/Item";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { useStore } from "../../../../store/useStore";
import OptionSelectSheet, {
  SelectOption,
} from "../../shared/OptionSelectSheet";

type ItemDetailsBottomSheetProps = {
  open: boolean;
  item: Item | null;
  isAddMode: boolean;
  isLoading?: boolean;
  onSave: (item: Item) => void;
  onDismiss: () => void;
};

type FormValues = {
  name: string;
  description: string;
  typeId: number;
  typeName: string;
  isActive: boolean;
  supplierPrice: string;
  wholesalePrice: string;
  retailPrice: string;
  packUomId: number;
  packUomName: string;
  singleUomId: number;
  singleUomName: string;
};

export default function ItemDetailsBottomSheet({
  open,
  item,
  isAddMode,
  isLoading = false,
  onSave,
  onDismiss,
}: ItemDetailsBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);

  const itemTypes = useStore((s) => s.itemTypes) ?? [];
  const uoms = useStore((s) => s.uoms) ?? [];

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { isValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      typeId: 0,
      typeName: "",
      isActive: true,
      supplierPrice: "0.00",
      wholesalePrice: "0.00",
      retailPrice: "0.00",
      packUomId: 0,
      packUomName: "",
      singleUomId: 0,
      singleUomName: "",
    },
  });
  const itemTypeOptions = useMemo<SelectOption[]>(
    () => itemTypes.map((t) => ({ id: t.id, label: t.description })),
    [itemTypes],
  );

  const uomOptions = useMemo<SelectOption[]>(
    () => uoms.map((u) => ({ id: u.id, label: u.displayLabel ?? u.name })),
    [uoms],
  );

  useEffect(() => {
    if (open) {
      reset({
        name: item?.name ?? "",
        description: item?.description ?? "",
        typeId: item?.typeId ?? 0,
        typeName: item?.type ?? "",
        isActive: item?.isActive ?? true,
        supplierPrice: item ? item.supplierPrice.toFixed(2) : "0.00",
        wholesalePrice: item ? item.wholesalePrice.toFixed(2) : "0.00",
        retailPrice: item ? item.retailPrice.toFixed(2) : "0.00",
        packUomId: item?.packUomId ?? 0,
        packUomName: item?.packUom ?? "",
        singleUomId: item?.singleUomId ?? 0,
        singleUomName: item?.singleUom ?? "",
      });
      // Validate immediately so isValid reflects the reset values
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

  const snapPoints = useMemo(() => ["90%"], []);

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
    const base = item ?? ({} as Item);
    const updatedItem: Item = {
      ...base,
      name: data.name.trim(),
      description: data.description.trim() || null,
      typeId: data.typeId,
      type: data.typeName || null,
      isActive: data.isActive,
      supplierPrice: Number(data.supplierPrice) || 0,
      wholesalePrice: Number(data.wholesalePrice) || 0,
      retailPrice: Number(data.retailPrice) || 0,
      packUomId: data.packUomId,
      packUom: data.packUomName,
      singleUomId: data.singleUomId,
      singleUom: data.singleUomName,
    };
    onSave(updatedItem);
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
        if (index === -1) {
          onDismiss();
        }
      }}
    >
      <View style={styles.container}>
        <BottomSheetScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header: active toggle right */}
          <View style={styles.headerRow}>
            <View style={styles.activeToggle}>
              <Text style={styles.switchLabel}>Active</Text>
              <Controller
                control={control}
                name="isActive"
                render={({ field: { value, onChange } }) => (
                  <Switch value={value} onValueChange={onChange} />
                )}
              />
            </View>
          </View>

          {/* Name */}
          <Controller
            control={control}
            name="name"
            rules={{
              validate: (v) => v.trim().length > 0 || "Item name is required",
            }}
            render={({
              field: { value, onChange, onBlur },
              fieldState: { error },
            }) => (
              <>
                <TextInput
                  label="Item Name"
                  value={value || " "}
                  onChangeText={(text) => onChange(text.replace(/^ /, ""))}
                  onBlur={onBlur}
                  mode="outlined"
                  error={!!error}
                  style={styles.input}
                />
              </>
            )}
          />

          {/* Description + Type */}
          <View style={[styles.row, styles.rowMb]}>
            <View style={styles.col}>
              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange } }) => (
                  <TextInput
                    label="Description"
                    value={value || " "}
                    onChangeText={(text) => onChange(text.replace(/^ /, ""))}
                    mode="outlined"
                  />
                )}
              />
            </View>
            <View style={styles.col}>
              <Controller
                control={control}
                name="typeId"
                rules={{ validate: (v) => v > 0 || "Type is required" }}
                render={({ field: { onChange }, fieldState: { error } }) => (
                  <>
                    <OptionSelectSheet
                      label="Type"
                      value={watch("typeName")}
                      options={itemTypeOptions}
                      onSelect={(opt) => {
                        onChange(opt.id);
                        setValue("typeName", opt.label);
                      }}
                      error={!!error}
                    />
                  </>
                )}
              />
            </View>
          </View>

          {/* Prices — 2 columns */}
          <Text style={styles.sectionLabel}>Prices</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Controller
                control={control}
                name="supplierPrice"
                rules={{
                  required: "Required",
                  validate: (v) => !isNaN(Number(v)) || "Invalid",
                }}
                render={({
                  field: { value, onChange, onBlur },
                  fieldState: { error },
                }) => (
                  <>
                    <TextInput
                      label="Supplier"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                      mode="outlined"
                      error={!!error}
                      placeholder="0.00"
                      left={<TextInput.Affix text="₱" />}
                    />
                  </>
                )}
              />
            </View>
            <View style={styles.col}>
              <Controller
                control={control}
                name="wholesalePrice"
                rules={{
                  required: "Required",
                  validate: (v) => !isNaN(Number(v)) || "Invalid",
                }}
                render={({
                  field: { value, onChange, onBlur },
                  fieldState: { error },
                }) => (
                  <>
                    <TextInput
                      label="Wholesale"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                      mode="outlined"
                      error={!!error}
                      placeholder="0.00"
                      left={<TextInput.Affix text="₱" />}
                    />
                  </>
                )}
              />
            </View>
          </View>

          <View style={[styles.row, styles.rowMt]}>
            <View style={styles.col}>
              <Controller
                control={control}
                name="retailPrice"
                rules={{
                  required: "Required",
                  validate: (v) => !isNaN(Number(v)) || "Invalid",
                }}
                render={({
                  field: { value, onChange, onBlur },
                  fieldState: { error },
                }) => (
                  <>
                    <TextInput
                      label="Retail"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                      mode="outlined"
                      error={!!error}
                      placeholder="0.00"
                      left={<TextInput.Affix text="₱" />}
                    />
                  </>
                )}
              />
            </View>
            <View style={styles.col} />
          </View>

          {/* UOMs — 2 columns */}
          <Text style={styles.sectionLabel}>Unit of Measure</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Controller
                control={control}
                name="packUomId"
                rules={{ validate: (v) => v > 0 || "Required" }}
                render={({ field: { onChange }, fieldState: { error } }) => (
                  <>
                    <OptionSelectSheet
                      label="Pack"
                      value={watch("packUomName")}
                      options={uomOptions}
                      onSelect={(opt) => {
                        onChange(opt.id);
                        setValue("packUomName", opt.label);
                      }}
                      error={!!error}
                    />
                  </>
                )}
              />
            </View>
            <View style={styles.col}>
              <Controller
                control={control}
                name="singleUomId"
                rules={{ validate: (v) => v > 0 || "Required" }}
                render={({ field: { onChange }, fieldState: { error } }) => (
                  <>
                    <OptionSelectSheet
                      label="Single"
                      value={watch("singleUomName")}
                      options={uomOptions}
                      onSelect={(opt) => {
                        onChange(opt.id);
                        setValue("singleUomName", opt.label);
                      }}
                      error={!!error}
                    />
                  </>
                )}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              disabled={!isValid || isLoading}
              loading={isLoading}
            >
              {isAddMode ? "Add Item" : "Save Changes"}
            </Button>
            <Button
              onPress={onDismiss}
              disabled={isLoading}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
          </View>
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    sheetBackground: {
      borderTopWidth: 1,
      borderTopColor: colors.surfaceDisabled,
    },
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    input: {
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.outline,
      marginTop: 8,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    rowMt: {
      marginTop: 12,
    },
    rowMb: {
      marginBottom: 16,
    },
    col: {
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginBottom: 4,
    },
    activeToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    switchLabel: {
      fontSize: 12,
      color: colors.outline,
    },
    footer: {
      marginTop: 24,
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
  });
