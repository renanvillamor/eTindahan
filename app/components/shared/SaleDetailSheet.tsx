import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { SaleToday } from "@/models/SaleToday";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text } from "react-native-paper";

type Props = {
  open: boolean;
  sale: SaleToday | null;
  onDelete: () => void;
  onUndo: () => void;
  onDismiss: () => void;
};

export default function SaleDetailSheet({
  open,
  sale,
  onDelete,
  onUndo,
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [open]);

  const snapPoints = useMemo(() => ["48%"], []);

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

  const timeLabel = sale?.transactionDate
    ? format(new Date(sale.transactionDate), "MMM d, yyyy · h:mm a")
    : null;

  const isPendingDelete = sale?.pendingDelete === true;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableHandlePanningGesture
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      onChange={(index) => {
        if (index === -1) onDismiss();
      }}
    >
      <View style={styles.content}>
        <Text style={styles.itemName} numberOfLines={2}>
          {sale?.name ?? ""}
        </Text>
        {isPendingDelete && (
          <Text style={styles.pendingBadge}>Pending deletion</Text>
        )}

        <Divider style={styles.divider} />

        <View style={styles.detailRows}>
          {timeLabel ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{timeLabel}</Text>
            </View>
          ) : null}
          {sale?.paymentMode ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment</Text>
              <Text style={[styles.detailValue, styles.paymentValue]}>
                {sale.paymentMode}
              </Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price × Qty</Text>
            <Text style={styles.detailValue}>
              {formatCurrency(sale?.price ?? 0)} × {sale?.quantity ?? 0}{" "}
              {sale?.uom ?? ""}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(sale?.total ?? 0)}
            </Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.actions}>
          {isPendingDelete ? (
            <Button
              mode="contained-tonal"
              onPress={onUndo}
              buttonColor="#fef3c7"
              textColor="#d97706"
            >
              Undo Deletion
            </Button>
          ) : (
            <Button
              mode="contained-tonal"
              onPress={onDelete}
              buttonColor="#fee2e2"
              textColor="#ef4444"
            >
              Delete Sale
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={onDismiss}
            style={styles.cancelButton}
          >
            Close
          </Button>
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
    content: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    itemName: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.onBackground,
      textAlign: "center",
      paddingVertical: 8,
    },
    pendingBadge: {
      textAlign: "center",
      color: "#d97706",
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 4,
    },
    divider: {
      marginVertical: 12,
    },
    detailRows: {
      gap: 10,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    detailLabel: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.onBackground,
    },
    paymentValue: {
      color: "#6366f1",
      fontWeight: "600",
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.onBackground,
    },
    actions: {
      gap: 8,
    },
    cancelButton: {
      marginTop: 4,
    },
  });
