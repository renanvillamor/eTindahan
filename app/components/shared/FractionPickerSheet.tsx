import { useAppTheme } from "@/hooks/useAppTheme";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Divider, List, Text } from "react-native-paper";

const FRACTIONS = [
  { label: "¼", name: "One-Fourth", decimal: 0.25 },
  { label: "½", name: "One-Half", decimal: 0.5 },
  { label: "¾", name: "Three-Fourths", decimal: 0.75 },
];

type Fraction = (typeof FRACTIONS)[number];

type Props = {
  open: boolean;
  itemName?: string;
  currentQty: number;
  onSelect: (decimal: number) => void;
  onDismiss: () => void;
};

export default function FractionPickerSheet({
  open,
  itemName,
  currentQty,
  onSelect,
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["40%"], []);
  const wholeQty = Math.floor(currentQty);

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [open]);

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

  const renderItem = useCallback(
    ({ item }: { item: Fraction }) => {
      const result = wholeQty + item.decimal;
      return (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            onSelect(item.decimal);
            onDismiss();
          }}
        >
          <List.Item
            title={`${item.label}  ${item.name}`}
            titleStyle={styles.rowTitle}
            right={() => (
              <View style={styles.resultBox}>
                <Text
                  style={[
                    styles.resultLabel,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  result
                </Text>
                <Text style={[styles.resultValue, { color: colors.onSurface }]}>
                  {result}
                </Text>
              </View>
            )}
            style={styles.row}
          />
        </TouchableOpacity>
      );
    },
    [wholeQty, onSelect, onDismiss, colors],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.outline }}
      onChange={(i) => {
        if (i === -1) onDismiss();
      }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[styles.headerTitle, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {itemName ?? "Select fraction"}
        </Text>
        <Text style={[styles.headerSub, { color: colors.onSurfaceVariant }]}>
          Choose a fractional amount to add
        </Text>
      </View>

      <Divider />

      <BottomSheetFlatList
        data={FRACTIONS}
        keyExtractor={(item: Fraction) => item.label}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={styles.listContent}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  resultBox: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 4,
    minWidth: 56,
  },
  resultLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  resultValue: {
    fontSize: 20,
    fontWeight: "700",
  },
});
