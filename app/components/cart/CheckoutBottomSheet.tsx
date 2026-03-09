import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { Item } from "@/models/Item";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Text as RNText, StyleSheet, View } from "react-native";
import { Button, Divider, List, Text } from "react-native-paper";

type Props = {
  open: boolean;
  items: Item[];
  qtyByItemId: Record<number, number>;
  onPay: () => void;
  onDismiss?: () => void;
};

export default function CheckoutBottomSheet({
  open,
  items,
  qtyByItemId,
  onPay,
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (open) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  const snapPoints = useMemo(() => ["65%"], []);

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

  const cartRows = useMemo(() => {
    return items
      .filter((it) => (qtyByItemId[it.id] ?? 0) > 0)
      .map((it) => {
        const qty = qtyByItemId[it.id];
        const subtotal = it.retailPrice * qty;
        return { item: it, qty, subtotal };
      });
  }, [items, qtyByItemId]);

  const total = useMemo(
    () => cartRows.reduce((sum, r) => sum + r.subtotal, 0),
    [cartRows],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableHandlePanningGesture
      enableContentPanningGesture
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      onChange={(index) => {
        if (index === -1) onDismiss?.();
      }}
    >
      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.title}>Order Summary</Text>
        <Divider />

        {/* Item list */}
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {cartRows.map(({ item, qty, subtotal }) => (
            <List.Item
              key={item.id}
              title={item.name}
              titleNumberOfLines={1}
              description={() => (
                <RNText className="text-sm text-gray-500">
                  {formatCurrency(item.retailPrice)} × {qty} {item.singleUom}/s
                </RNText>
              )}
              descriptionNumberOfLines={1}
              style={styles.listItem}
              right={() => (
                <View style={styles.subtotalWrapper}>
                  <Text style={styles.subtotal}>
                    {formatCurrency(subtotal)}
                  </Text>
                </View>
              )}
            />
          ))}
        </BottomSheetScrollView>

        {/* Footer */}
        <Divider />
        <View style={styles.footer}>
          <View>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
          </View>
          <Button
            mode="contained"
            onPress={onPay}
            contentStyle={styles.payContent}
          >
            Pay
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    sheetBackground: {
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 12,
      color: colors.onBackground,
    },
    scrollContent: {
      paddingBottom: 8,
    },
    listItem: {
      paddingVertical: 4,
      paddingLeft: 16,
      paddingRight: 8,
    },
    subtotalWrapper: {
      justifyContent: "center",
      alignItems: "flex-end",
      minWidth: 80,
      paddingRight: 8,
    },
    subtotal: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.onBackground,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    totalLabel: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
    },
    totalAmount: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.onBackground,
    },
    payContent: {
      paddingHorizontal: 24,
      height: 44,
    },
  });
