import DateSelector from "@/app/components/shared/DateSelector";
import SearchFilterBar, {
  SortOption,
} from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { Delivery } from "@/models/Delivery";
import { useGetDeliveryReport } from "@/services/useGetDeliveryReport";
import { useStore } from "@/store/useStore";
import { format } from "date-fns";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { SectionList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Divider,
  Icon,
  IconButton,
  Text,
} from "react-native-paper";

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Item" },
  { key: "supplier", label: "Supplier" },
  { key: "total", label: "Total" },
];

function fmt(val: number) {
  return formatCurrency(val);
}

export default function DailyDeliveriesReport() {
  const { colors } = useAppTheme();
  const [date, setDate] = useState(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  const items = useStore((s) => s.items);
  const suppliers = useStore((s) => s.suppliers);
  const uoms = useStore((s) => s.uoms);

  const {
    data: rawData = [],
    isLoading,
    isFetching,
    refetch,
    error,
  } = useGetDeliveryReport(dateStr);

  // Resolve names from store since the query returns raw IDs only
  const data = useMemo<Delivery[]>(
    () =>
      rawData.map((d) => ({
        ...d,
        itemName: items.find((i) => i.id === d.itemId)?.name ?? d.itemName,
        supplierName:
          suppliers.find((s) => s.id === d.supplierId)?.name ?? d.supplierName,
        uom: uoms.find((u) => u.id === d.uomId)?.name ?? d.uom,
      })),
    [rawData, items, suppliers, uoms],
  );

  const grandTotal = useMemo(
    () => data.reduce((sum, d) => sum + d.total, 0),
    [data],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Daily Deliveries",
          headerTitleAlign: "center",
          animation: "slide_from_right",
          headerLeft: () => (
            <View className="w-12 h-12 items-center justify-center -ml-2">
              <IconButton
                icon="arrow-left"
                size={24}
                onPress={() => router.back()}
                accessibilityLabel="Back"
                className="m-0"
              />
            </View>
          ),
          headerRight: () => (
            <View className="w-12 h-12 items-center justify-center -mr-2">
              <IconButton
                icon="refresh"
                size={22}
                onPress={() => refetch()}
                disabled={isFetching}
                accessibilityLabel="Refresh"
                className="m-0"
              />
            </View>
          ),
        }}
      />

      <View className="flex-1 bg-white">
        <DateSelector value={date} onChange={setDate} label="Delivery Date" />

        <SearchFilterBar
          placeholder="Search item or supplier..."
          sortOptions={SORT_OPTIONS}
        >
          {(query, selectedType, sortKey, sortDir) => {
            if (isLoading) {
              return (
                <View className="flex-1 items-center justify-center py-16">
                  <ActivityIndicator color={colors.primary} size="large" />
                  <Text className="text-gray-400 mt-3">Loading...</Text>
                </View>
              );
            }

            if (error) {
              return (
                <View className="flex-1 items-center justify-center py-16 gap-2">
                  <Icon
                    source="alert-circle-outline"
                    size={40}
                    color="#dc2626"
                  />
                  <Text className="text-red-500 text-center px-6">
                    {error.message}
                  </Text>
                </View>
              );
            }

            let rows = data.filter((d) => {
              const q = query.trim().toLowerCase();
              return (
                !q ||
                (d.itemName ?? "").toLowerCase().includes(q) ||
                (d.supplierName ?? "").toLowerCase().includes(q)
              );
            });

            if (sortKey) {
              rows = [...rows].sort((a, b) => {
                const dir = sortDir === "asc" ? 1 : -1;
                switch (sortKey) {
                  case "name":
                    return (
                      dir * (a.itemName ?? "").localeCompare(b.itemName ?? "")
                    );
                  case "supplier":
                    return (
                      dir *
                      (a.supplierName ?? "").localeCompare(b.supplierName ?? "")
                    );
                  case "total":
                    return dir * (a.total - b.total);
                  default:
                    return 0;
                }
              });
            }

            if (rows.length === 0) {
              return (
                <View className="flex-1 items-center justify-center py-16 gap-2">
                  <Icon
                    source="truck-delivery-outline"
                    size={40}
                    color="#d1d5db"
                  />
                  <Text className="text-gray-400">
                    No deliveries on this date
                  </Text>
                </View>
              );
            }

            // Group rows by supplier
            const sections = Object.entries(
              rows.reduce<Record<string, Delivery[]>>((acc, d) => {
                const key = d.supplierName ?? "Unknown Supplier";
                if (!acc[key]) acc[key] = [];
                acc[key].push(d);
                return acc;
              }, {}),
            ).map(([supplier, sectionData]) => ({
              supplier,
              data: sectionData,
            }));

            return (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                ItemSeparatorComponent={() => <Divider />}
                ListHeaderComponent={
                  <View
                    style={[
                      styles.headerRow,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <View style={styles.nameCol}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        ITEM
                      </Text>
                    </View>
                    <View style={styles.qtyCol}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        QTY
                      </Text>
                    </View>
                    <View style={styles.priceCol}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        PRICE
                      </Text>
                    </View>
                    <View style={styles.priceCol}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        TOTAL
                      </Text>
                    </View>
                  </View>
                }
                renderSectionHeader={({ section }) => (
                  <View style={styles.sectionHeader}>
                    <Icon
                      source="truck-delivery-outline"
                      size={14}
                      color="#6b7280"
                    />
                    <Text style={styles.sectionHeaderText}>
                      {section.supplier}
                    </Text>
                  </View>
                )}
                ListFooterComponent={
                  <View
                    style={[
                      styles.footerRow,
                      { borderTopColor: colors.primary },
                    ]}
                  >
                    <View style={styles.nameCol}>
                      <Text
                        style={[styles.footerLabel, { color: colors.primary }]}
                      >
                        GRAND TOTAL
                      </Text>
                    </View>
                    <View style={styles.qtyCol} />
                    <View style={styles.priceCol} />
                    <View style={styles.priceCol}>
                      <Text
                        style={[styles.footerValue, { color: colors.primary }]}
                      >
                        {fmt(grandTotal)}
                      </Text>
                    </View>
                  </View>
                }
                renderItem={({
                  item,
                  index,
                }: {
                  item: Delivery;
                  index: number;
                }) => (
                  <View
                    style={[styles.dataRow, index % 2 === 1 && styles.altRow]}
                  >
                    <View style={styles.nameCol}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.itemName ?? `Item #${item.itemId}`}
                      </Text>
                    </View>
                    <View style={styles.qtyCol}>
                      <Text style={styles.dataValue}>{item.quantity}</Text>
                      {item.uom ? (
                        <Text style={styles.unitLabel}>{item.uom}</Text>
                      ) : null}
                    </View>
                    <View style={styles.priceCol}>
                      <Text style={styles.dataValue}>{fmt(item.price)}</Text>
                    </View>
                    <View style={styles.priceCol}>
                      <Text style={[styles.dataValue, styles.totalValue]}>
                        {fmt(item.total)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            );
          }}
        </SearchFilterBar>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 2,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: "700",
    paddingLeft: 8,
  },
  footerValue: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  nameCol: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  qtyCol: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  priceCol: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dataRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 52,
    alignItems: "center",
  },
  altRow: {
    backgroundColor: "#f9fafb",
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dataValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
  totalValue: {
    fontWeight: "700",
  },
  unitLabel: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 1,
  },
});
