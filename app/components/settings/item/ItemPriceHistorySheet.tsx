import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { Item } from "@/models/Item";
import {
  ItemPriceHistoryRow,
  useGetItemPriceHistory,
} from "@/services/useGetItemPriceHistory";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
} from "@gorhom/bottom-sheet";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Divider, Icon, Text } from "react-native-paper";

type Props = {
  open: boolean;
  item: Item | null;
  onDismiss: () => void;
};

function formatPriceDate(ts: string | null): string {
  if (!ts) return "—";
  let iso = ts.replace(" ", "T");
  if (!iso.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(iso)) iso += "Z";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function formatPriceTime(ts: string | null): string {
  if (!ts) return "";
  let iso = ts.replace(" ", "T");
  if (!iso.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(iso)) iso += "Z";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "h:mm a") : "";
}

const TableHeader = () => (
  <View style={styles.tableHeader}>
    <View style={styles.colDate}>
      <Text style={styles.headerText}>Date</Text>
    </View>
    <View style={styles.colPrice}>
      <Text style={styles.headerText}>Supplier</Text>
    </View>
    <View style={styles.colPrice}>
      <Text style={styles.headerText}>Wholesale</Text>
    </View>
    <View style={styles.colPrice}>
      <Text style={styles.headerText}>Retail</Text>
    </View>
  </View>
);

export default function ItemPriceHistorySheet({
  open,
  item,
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();
  const sheetRef = useRef<BottomSheet>(null);

  const { data: rows = [], isLoading } = useGetItemPriceHistory(
    open ? (item?.id ?? null) : null,
  );

  useEffect(() => {
    if (open) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [open]);

  const snapPoints = useMemo(() => ["55%", "85%"], []);

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

  const packSize = item?.packSize && item.packSize > 0 ? item.packSize : null;

  const renderItem = useCallback(
    ({ item: row, index }: { item: ItemPriceHistoryRow; index: number }) => {
      const isEven = index % 2 === 0;
      return (
        <View style={[styles.tableRow, isEven && styles.tableRowAlt]}>
          <View style={styles.colDate}>
            <Text style={styles.cellDate}>
              {formatPriceDate(row.createdAt)}
            </Text>
            <Text style={styles.cellTime}>
              {formatPriceTime(row.createdAt)}
            </Text>
          </View>
          <View style={styles.colPrice}>
            <Text style={styles.cellPrice}>
              {formatCurrency(row.supplierPrice)}
            </Text>
          </View>
          <View style={styles.colPrice}>
            <Text style={styles.cellPrice}>
              {formatCurrency(row.wholesalePrice)}
            </Text>
          </View>
          <View style={styles.colPrice}>
            <Text style={styles.cellPrice}>
              {formatCurrency(row.retailPrice)}
            </Text>
          </View>
        </View>
      );
    },
    [packSize],
  );

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
      handleIndicatorStyle={styles.handle}
      onChange={(index) => {
        if (index === -1) onDismiss();
      }}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {item?.name ?? ""}
        </Text>
        <Text style={styles.subtitle}>Price History</Text>
      </View>

      <Divider />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <Icon source="clock-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No price records found</Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={rows}
          keyExtractor={(r: ItemPriceHistoryRow) => String(r.id)}
          renderItem={renderItem}
          ListHeaderComponent={<TableHeader />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
  },
  handle: {
    backgroundColor: "#d1d5db",
    width: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  listContent: {
    paddingBottom: 32,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  colDate: {
    width: 82,
    paddingRight: 4,
  },
  colPrice: {
    flex: 1,
    alignItems: "flex-end",
  },
  headerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cellDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  cellTime: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 1,
  },
  cellPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
});
