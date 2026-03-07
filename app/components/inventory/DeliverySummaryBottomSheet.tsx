import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, List, Switch } from "react-native-paper";

type ItemLike = {
  id: number;
  name?: string | null;
  supplierPrice?: number | null;
  deliveryUom?: string | null;
};

type DeliverySummaryBottomSheetProps = {
  open: boolean;
  supplierName: string | null;
  items: ItemLike[];
  qtyByItemId: Record<number, number>;
  onSave: () => void;
  onDismiss?: () => void;
};

export default function DeliverySummaryBottomSheet({
  open,
  supplierName,
  items,
  qtyByItemId,
  onSave,
  onDismiss,
}: DeliverySummaryBottomSheetProps) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);
  const [isPaid, setIsPaid] = useState(true);

  useEffect(() => {
    if (open) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  const snapPoints = useMemo(() => ["70%"], []);

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

  const selectedItems = useMemo(() => {
    return items.map((it) => {
      const qty = qtyByItemId[it.id] ?? 0;
      const price = Number(it.supplierPrice ?? 0);
      const subtotal = price * Number(qty);
      return {
        item: it,
        qty,
        price,
        subtotal,
      };
    });
  }, [items, qtyByItemId]);

  const total = useMemo(() => {
    return selectedItems.reduce((sum, row) => sum + row.subtotal, 0);
  }, [selectedItems]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={true}
      enableHandlePanningGesture={true}
      enableContentPanningGesture={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      onChange={(index) => {
        if (index === -1) {
          onDismiss?.();
        }
      }}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <View className="flex-row mb-3 items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500 mr-2">Supplier:</Text>
              <Text className="font-semibold">
                {supplierName?.toUpperCase() ?? "(none)"}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500 mr-2">Paid</Text>
              <Switch value={isPaid} onValueChange={setIsPaid} />
            </View>
          </View>

          <BottomSheetScrollView
            style={styles.itemsScroll}
            contentContainerStyle={styles.itemsContent}
          >
            {selectedItems.map(({ item, qty, price, subtotal }) => {
              return (
                <List.Item
                  key={item.id}
                  title={item.name ?? "Unnamed item"}
                  description={() => (
                    <Text className="text-sm text-gray-500">
                      {`${formatCurrency(price)} x ${qty} ${item.deliveryUom ? item.deliveryUom + "/s" : ""}`}
                    </Text>
                  )}
                  right={() => (
                    <Text className="text-sm text-gray-700">
                      {formatCurrency(subtotal)}
                    </Text>
                  )}
                  contentStyle={{ marginVertical: 0 }}
                />
              );
            })}
          </BottomSheetScrollView>

          <View className="mt-3 pt-3 border-t border-gray-200">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold">TOTAL</Text>
              <Text className="text-base font-semibold">
                {formatCurrency(total)}
              </Text>
            </View>

            <View style={styles.footer}>
              <Button mode="contained" onPress={onSave}>
                Complete Delivery
              </Button>
            </View>
          </View>
        </View>
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
      paddingHorizontal: 16,
      paddingBottom: 24,
      flex: 1,
    },
    itemsScroll: {
      flex: 1,
    },
    itemsContent: {
      paddingBottom: 8,
    },
    footer: {
      marginTop: 16,
    },
  });
