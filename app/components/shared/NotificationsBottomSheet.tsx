import { useAppTheme } from "@/hooks/useAppTheme";
import { FREQUENCY_LABELS } from "@/lib/recurringExpense";
import { formatCurrency } from "@/lib/utils";
import { RecurringExpense } from "@/models/RecurringExpense";
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "react-native-paper";

type Props = {
  open: boolean;
  dueRecurringExpenses: RecurringExpense[];
  onLog: (template: RecurringExpense) => void;
  onSkip: (template: RecurringExpense) => void;
  onDismiss: () => void;
};

export default function NotificationsBottomSheet({
  open,
  dueRecurringExpenses,
  onLog,
  onSkip,
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [open]);

  const snapPoints = useMemo(() => ["55%"], []);

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
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableHandlePanningGesture
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      onChange={(index) => {
        if (index === -1) onDismiss();
      }}
    >
      <View style={styles.header}>
        <Icon source="bell-outline" size={18} color={colors.onSurfaceVariant} />
        <Text style={styles.headerText}>Notifications</Text>
      </View>

      <BottomSheetFlatList
        data={dueRecurringExpenses}
        keyExtractor={(item: RecurringExpense) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon source="bell-check-outline" size={28} color="#9ca3af" />
            <Text style={styles.emptyText}>You're all caught up</Text>
          </View>
        }
        renderItem={({ item: template }: { item: RecurringExpense }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {template.expenseCategoryName ?? "Uncategorized"}
              </Text>
              <Text style={styles.rowSubtitle}>
                {formatCurrency(template.amount)} ·{" "}
                {FREQUENCY_LABELS[template.frequency]}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Button
                mode="text"
                compact
                onPress={() => onSkip(template)}
                textColor="#9ca3af"
              >
                Skip
              </Button>
              <Button mode="contained-tonal" compact onPress={() => onLog(template)}>
                Log
              </Button>
            </View>
          </View>
        )}
      />
    </BottomSheet>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    sheetBackground: {
      borderTopWidth: 1,
      borderTopColor: colors.surfaceDisabled,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onBackground,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: "#f3f4f6",
    },
    rowInfo: {
      flex: 1,
      paddingRight: 8,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.onBackground,
    },
    rowSubtitle: {
      fontSize: 12,
      color: "#6b7280",
      marginTop: 2,
    },
    rowActions: {
      flexDirection: "row",
      gap: 4,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      gap: 8,
    },
    emptyText: {
      fontSize: 13,
      color: "#9ca3af",
    },
  });
