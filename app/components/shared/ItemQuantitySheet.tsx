import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { Item } from "@/models/Item";
import { useStore } from "@/store/useStore";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Divider, Text, TextInput } from "react-native-paper";

const FRACTIONS = [
  { label: "¼", name: "One-Fourth", decimal: 0.25 },
  { label: "½", name: "One-Half", decimal: 0.5 },
  { label: "¾", name: "Three-Fourths", decimal: 0.75 },
];

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

type Mode = "qty" | "amount" | "pieces";

type Props = {
  open: boolean;
  item: Item | null;
  currentQty: number;
  onApply: (qty: number) => void;
  onDismiss: () => void;
  /**
   * Price used to compute quantity in "Amount" mode.
   * - omitted -> defaults to item.retailPrice
   * - null -> "Amount" mode is not applicable; the tab is hidden
   * - a number -> used directly (e.g. item.supplierPrice for deliveries)
   */
  amountPrice?: number | null;
  /** Unit label shown in Amount/Pieces preview text. Defaults to item.singleUom. */
  qtyUnitLabel?: string;
  /** Describes the price used in Amount mode's hint text. Defaults to "retail price". */
  priceLabel?: string;
};

export default function ItemQuantitySheet({
  open,
  item,
  currentQty,
  onApply,
  onDismiss,
  amountPrice,
  qtyUnitLabel,
  priceLabel,
}: Props) {
  const { colors } = useAppTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["60%"], []);
  const uoms = useStore((s) => s.uoms) ?? [];

  const packUom = useMemo(
    () => uoms.find((u) => u.id === item?.packUomId) ?? null,
    [uoms, item?.packUomId],
  );
  const packSize =
    item?.packSize && item.packSize > 0
      ? item.packSize
      : packUom?.packSize && packUom.packSize > 0
        ? packUom.packSize
        : null;
  const showAmountTab = amountPrice !== null;
  const resolvedAmountPrice =
    amountPrice === null ? 0 : (amountPrice ?? item?.retailPrice ?? 0);
  const unitLabel = qtyUnitLabel ?? item?.singleUom ?? "";
  const resolvedPriceLabel = priceLabel ?? "retail price";

  const [mode, setMode] = useState<Mode>("qty");
  const [wholeText, setWholeText] = useState("");
  const [amountText, setAmountText] = useState("");
  const [boxesText, setBoxesText] = useState("");
  const [piecesText, setPiecesText] = useState("");

  useEffect(() => {
    if (open) {
      setMode("qty");
      setWholeText(String(Math.floor(currentQty)));
      setAmountText("");
      setBoxesText("");
      setPiecesText("");
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open, item?.id]);

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

  const parsedWhole = parseFloat(wholeText.replace(/[^0-9.]/g, ""));
  const wholeQty = Number.isNaN(parsedWhole) ? 0 : parsedWhole;

  const parsedAmount = parseFloat(amountText.replace(/[^0-9.]/g, ""));
  const amountQty =
    !Number.isNaN(parsedAmount) && resolvedAmountPrice > 0
      ? round(parsedAmount / resolvedAmountPrice)
      : null;

  const parsedBoxes = parseFloat(boxesText.replace(/[^0-9.]/g, ""));
  const boxesWhole = Number.isNaN(parsedBoxes) ? 0 : parsedBoxes;

  const parsedPieces = parseFloat(piecesText.replace(/[^0-9.]/g, ""));
  const piecesQty =
    packSize && (!Number.isNaN(parsedBoxes) || !Number.isNaN(parsedPieces))
      ? round(
          boxesWhole +
            (Number.isNaN(parsedPieces) ? 0 : parsedPieces) / packSize,
        )
      : null;

  const handleApplyFraction = (decimal: number) => {
    onApply(wholeQty + decimal);
    onDismiss();
  };

  const handleApplyAmount = () => {
    if (amountQty !== null) {
      onApply(amountQty);
      onDismiss();
    }
  };

  const handleApplyPieces = () => {
    if (piecesQty !== null) {
      onApply(piecesQty);
      onDismiss();
    }
  };

  const modeOptions = useMemo(() => {
    const options = [{ value: "qty", label: "Fraction" }];
    if (showAmountTab) options.push({ value: "amount", label: "Amount" });
    if (packSize) options.push({ value: "pieces", label: "Pieces" });
    return options;
  }, [showAmountTab, packSize]);

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
      <BottomSheetView style={styles.container}>
        <Text
          style={[styles.headerTitle, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {item?.name ?? "Select quantity"}
        </Text>
        <Text style={[styles.headerSub, { color: colors.onSurfaceVariant }]}>
          Choose how to specify the quantity
        </Text>
        <View style={styles.modeRow}>
          {modeOptions.map((opt) => {
            const isSelected = mode === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                activeOpacity={0.75}
                onPress={() => setMode(opt.value as Mode)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.secondary,
                    borderColor: isSelected ? colors.primary : colors.outline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    { color: isSelected ? "#fff" : colors.onSurface },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider style={styles.divider} />

        {mode === "qty" && (
          <View style={styles.tabContent}>
            <Text style={[styles.tabHint, { color: colors.onSurfaceVariant }]}>
              Enter the whole quantity, then tap a fraction to add to it
            </Text>
            <TextInput
              mode="outlined"
              label="Whole quantity"
              keyboardType="decimal-pad"
              value={wholeText}
              onChangeText={setWholeText}
              placeholder="0"
            />
            {FRACTIONS.map((f) => {
              const result = wholeQty + f.decimal;
              return (
                <TouchableOpacity
                  key={f.label}
                  activeOpacity={0.6}
                  onPress={() => handleApplyFraction(f.decimal)}
                  style={[styles.row, { borderColor: colors.outline }]}
                >
                  <Text style={styles.rowTitle}>{`${f.label}  ${f.name}`}</Text>
                  <View style={styles.resultBox}>
                    <Text
                      style={[
                        styles.resultLabel,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      result
                    </Text>
                    <Text
                      style={[styles.resultValue, { color: colors.onSurface }]}
                    >
                      {result}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {mode === "amount" && (
          <View style={styles.tabContent}>
            <Text style={[styles.tabHint, { color: colors.onSurfaceVariant }]}>
              Enter a peso amount and the quantity will be computed from the{" "}
              {resolvedPriceLabel} ({formatCurrency(resolvedAmountPrice)} /{" "}
              {unitLabel})
            </Text>
            <TextInput
              mode="outlined"
              label="Amount"
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              left={<TextInput.Affix text="₱" />}
              placeholder="0.00"
            />
            <Text style={[styles.previewText, { color: colors.onSurface }]}>
              {amountQty !== null
                ? `= ${amountQty} ${unitLabel}`
                : "Enter an amount to compute quantity"}
            </Text>
            <Button
              mode="contained"
              onPress={handleApplyAmount}
              disabled={amountQty === null}
              style={styles.applyButton}
            >
              Apply
            </Button>
          </View>
        )}

        {mode === "pieces" && packSize && (
          <View style={styles.tabContent}>
            <Text style={[styles.tabHint, { color: colors.onSurfaceVariant }]}>
              Enter whole {item?.packUom ?? "pack"}s and leftover pieces (
              {packSize} pieces per {item?.packUom ?? "pack"}) and the quantity
              will be computed accordingly
            </Text>
            <View style={styles.pieceInputRow}>
              <TextInput
                mode="outlined"
                label={`${item?.packUom ?? "Pack"}s`}
                keyboardType="decimal-pad"
                value={boxesText}
                onChangeText={setBoxesText}
                placeholder="0"
                style={styles.pieceInput}
              />
              <TextInput
                mode="outlined"
                label={item?.singleUom || "Pieces"}
                keyboardType="decimal-pad"
                value={piecesText}
                onChangeText={setPiecesText}
                placeholder="0"
                style={styles.pieceInput}
              />
            </View>
            <Text style={[styles.previewText, { color: colors.onSurface }]}>
              {piecesQty !== null
                ? `= ${piecesQty} ${unitLabel}`
                : "Enter boxes and/or pieces to compute quantity"}
            </Text>
            <Button
              mode="contained"
              onPress={handleApplyPieces}
              disabled={piecesQty === null}
              style={styles.applyButton}
            >
              Apply
            </Button>
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  modeChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    marginVertical: 16,
  },
  tabContent: {
    gap: 12,
  },
  tabHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  pieceInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  pieceInput: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  resultBox: {
    alignItems: "flex-end",
    justifyContent: "center",
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
  previewText: {
    fontSize: 14,
    fontWeight: "600",
  },
  applyButton: {
    marginTop: 4,
  },
});
