import { useAppTheme } from "@/hooks/useAppTheme";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useCallback, useRef } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { List, Text, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SelectOption = {
  id: number;
  label: string;
};

type OptionSelectSheetProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onSelect: (option: SelectOption) => void;
  error?: boolean;
  dense?: boolean;
};

export default function OptionSelectSheet({
  label,
  value,
  options,
  onSelect,
  error,
  dense,
}: OptionSelectSheetProps) {
  const { colors } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);

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

  return (
    <>
      <TouchableOpacity onPress={() => modalRef.current?.present()}>
        <TextInput
          label={label}
          value={value || " "}
          mode="outlined"
          editable={false}
          error={error}
          dense={dense}
          right={
            <TextInput.Icon
              icon="chevron-down"
              onPress={() => modalRef.current?.present()}
            />
          }
          pointerEvents="none"
        />
      </TouchableOpacity>

      <BottomSheetModal
        ref={modalRef}
        enableDynamicSizing
        maxDynamicContentSize={Dimensions.get("window").height * 0.85}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.outline }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingBottom: bottom }}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
              {label}
            </Text>
          </View>
          {options.map((item) => (
            <List.Item
              key={item.id}
              title={item.label}
              onPress={() => {
                onSelect(item);
                modalRef.current?.dismiss();
              }}
            />
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
});
