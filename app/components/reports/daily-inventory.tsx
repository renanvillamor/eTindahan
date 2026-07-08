import DateRangePicker from "@/app/components/shared/DateRangePicker";
import SearchFilterBar, {
  SortOption,
} from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useGetInventoryReport } from "@/services/useGetInventoryReport";
import { useStore } from "@/store/useStore";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, IconButton, Text } from "react-native-paper";

const MAX_DAYS = 4;
const NAME_COL_WIDTH = 130;
const DATE_COL_WIDTH = 64;

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
];

type TableItem = {
  itemId: number;
  itemName: string;
  type: string | null;
  typeId: number | null;
  uom: string | null;
  qtyByDate: Record<string, number>;
  minThreshold: number | null;
  maxThreshold: number | null;
};

export default function DailyInventoryReport() {
  const { colors } = useAppTheme();
  const items = useStore((s) => s.items);
  const suppliers = useStore((s) => s.suppliers);
  const supplierItems = useStore((s) => s.supplierItems);

  const today = new Date();
  const [fromDate, setFromDate] = useState(() => subDays(today, MAX_DAYS - 1));
  const [toDate, setToDate] = useState(today);

  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");

  const {
    data: rawData,
    isLoading,
    refetch,
    isFetching,
  } = useGetInventoryReport(fromStr, toStr);

  // All dates in the selected range — these become the table columns
  const dateCols = useMemo<string[]>(() => {
    return eachDayOfInterval({ start: fromDate, end: toDate }).map((d) =>
      format(d, "yyyy-MM-dd"),
    );
  }, [fromStr, toStr]);

  // qtyMap[itemId][date] = actualQty
  const qtyMap = useMemo<Record<number, Record<string, number>>>(() => {
    const map: Record<number, Record<string, number>> = {};
    if (!rawData) return map;
    for (const row of rawData) {
      if (!map[row.itemId]) map[row.itemId] = {};
      // First-wins: data is DESC by date then id, so the first record
      // for each item+date is the most recent — don't overwrite it.
      if (map[row.itemId][row.date] == null) {
        map[row.itemId][row.date] = row.actualQty;
      }
    }
    return map;
  }, [rawData]);

  // Unique item IDs that have at least one record in the range
  const uniqueItemIds = useMemo<number[]>(() => {
    if (!rawData) return [];
    return Array.from(new Set(rawData.map((r) => r.itemId)));
  }, [rawData]);

  // Build reverse map: itemId → supplierId[]
  const itemSupplierMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    for (const [supplierId, itemIds] of Object.entries(supplierItems)) {
      for (const itemId of itemIds) {
        if (!map[itemId]) map[itemId] = [];
        map[itemId].push(Number(supplierId));
      }
    }
    return map;
  }, [supplierItems]);

  // supplierName map
  const supplierNameMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Daily Inventory",
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
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          maxDays={MAX_DAYS}
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />

        <SearchFilterBar
          placeholder="Search items..."
          sortOptions={SORT_OPTIONS}
          showSupplierFilter
          suppliers={suppliers}
        >
          {(query, selectedType, selectedSupplierId, sortKey, sortDir) => {
            if (isLoading) {
              return (
                <View className="flex-1 items-center justify-center py-16">
                  <ActivityIndicator color={colors.primary} size="large" />
                  <Text className="text-gray-400 mt-3">Loading...</Text>
                </View>
              );
            }

            // Build & filter table rows (one row per unique item)
            let tableItems: TableItem[] = uniqueItemIds
              .map((itemId) => {
                const item = items.find((it) => it.id === itemId);
                return {
                  itemId,
                  itemName: item?.name ?? `Item #${itemId}`,
                  type: item?.type ?? null,
                  typeId: item?.typeId ?? null,
                  uom: item?.packUom ?? null,
                  qtyByDate: qtyMap[itemId] ?? {},
                  minThreshold: item?.minThreshold ?? null,
                  maxThreshold: item?.maxThreshold ?? null,
                };
              })
              .filter((row) => {
                const q = query.trim().toLowerCase();
                const matchesSupplier =
                  !selectedSupplierId ||
                  (itemSupplierMap[row.itemId] ?? []).includes(selectedSupplierId);
                return (
                  (!q || row.itemName.toLowerCase().includes(q)) &&
                  (!selectedType || row.typeId === selectedType) &&
                  matchesSupplier
                );
              });

            // Sort rows
            if (sortKey) {
              tableItems = [...tableItems].sort((a, b) => {
                const dir = sortDir === "asc" ? 1 : -1;
                switch (sortKey) {
                  case "name":
                    return dir * a.itemName.localeCompare(b.itemName);
                  case "type":
                    return dir * (a.type ?? "").localeCompare(b.type ?? "");
                  default:
                    return 0;
                }
              });
            } else {
              tableItems = [...tableItems].sort((a, b) =>
                a.itemName.localeCompare(b.itemName),
              );
            }

            if (tableItems.length === 0) {
              return (
                <View className="flex-1 items-center justify-center py-16 gap-2">
                  <Icon
                    source="clipboard-text-off-outline"
                    size={40}
                    color="#d1d5db"
                  />
                  <Text className="text-gray-400">
                    No inventory records found
                  </Text>
                </View>
              );
            }

            const tableWidth =
              NAME_COL_WIDTH + dateCols.length * DATE_COL_WIDTH;

            return (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={styles.tableOuter}
                contentContainerStyle={{ minWidth: tableWidth, flexGrow: 1 }}
              >
                <View style={{ width: tableWidth, flex: 1 }}>
                  {/* Fixed date header */}
                  <View
                    style={[
                      styles.headerRow,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <View style={[styles.nameCol, styles.headerCell]} />
                    {dateCols.map((d) => (
                      <View key={d} style={[styles.dateCol, styles.headerCell]}>
                        <Text
                          style={[
                            styles.headerDateTop,
                            { color: colors.primary },
                          ]}
                        >
                          {format(parseISO(d), "MMM d")}
                        </Text>
                        <Text
                          style={[
                            styles.headerDateDay,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          {format(parseISO(d), "EEE")}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Scrollable data rows only */}
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={styles.tableBodyScroll}
                  >
                    {(() => {
                      // Group tableItems by supplier
                      const grouped = new Map<number | null, TableItem[]>();
                      for (const item of tableItems) {
                        const supplierIds = itemSupplierMap[item.itemId];
                        if (supplierIds && supplierIds.length > 0) {
                          for (const sid of supplierIds) {
                            if (!grouped.has(sid)) grouped.set(sid, []);
                            grouped.get(sid)!.push(item);
                          }
                        } else {
                          if (!grouped.has(null)) grouped.set(null, []);
                          grouped.get(null)!.push(item);
                        }
                      }
                      const sections: {
                        supplierId: number | null;
                        title: string;
                        items: TableItem[];
                      }[] = [];
                      for (const [sid, its] of grouped.entries()) {
                        if (sid === null) continue;
                        sections.push({
                          supplierId: sid,
                          title: supplierNameMap.get(sid) ?? `Supplier #${sid}`,
                          items: its,
                        });
                      }
                      sections.sort((a, b) => a.title.localeCompare(b.title));
                      if (grouped.has(null))
                        sections.push({
                          supplierId: null,
                          title: "Other",
                          items: grouped.get(null)!,
                        });

                      let globalIdx = 0;
                      return sections.map((section) => (
                        <View key={section.supplierId ?? "other"}>
                          {/* Supplier header row */}
                          <View style={styles.supplierHeaderRow}>
                            <Text style={styles.supplierHeaderText}>
                              {section.title}
                            </Text>
                          </View>
                          {section.items.map((item) => {
                            const idx = globalIdx++;
                            return (
                              <View key={item.itemId}>
                                <View
                                  style={[
                                    styles.dataRow,
                                    idx % 2 === 1 && styles.altRow,
                                  ]}
                                >
                                  <View
                                    style={[styles.nameCol, styles.dataCell]}
                                  >
                                    <Text
                                      style={styles.itemName}
                                      numberOfLines={2}
                                    >
                                      {item.itemName}
                                    </Text>
                                  </View>
                                  {dateCols.map((d) => {
                                    const qty = item.qtyByDate[d];
                                    const has = qty != null;

                                    const isLow =
                                      has &&
                                      item.minThreshold != null &&
                                      qty <= item.minThreshold;
                                    const isHigh =
                                      has &&
                                      item.maxThreshold != null &&
                                      qty >= item.maxThreshold;

                                    const cellBg = isHigh
                                      ? "#fee2e2"
                                      : isLow
                                        ? "#ffedd5"
                                        : undefined;

                                    return (
                                      <View
                                        key={d}
                                        style={[
                                          styles.dateCol,
                                          styles.dataCell,
                                          styles.qtyCell,
                                          cellBg
                                            ? { backgroundColor: cellBg }
                                            : null,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.qtyValue,
                                            {
                                              color: isHigh
                                                ? "#dc2626"
                                                : isLow
                                                  ? "#ea580c"
                                                  : has
                                                    ? colors.onSurface
                                                    : "#d1d5db",
                                            },
                                          ]}
                                        >
                                          {has
                                            ? Number.isInteger(qty)
                                              ? qty
                                              : qty.toFixed(2)
                                            : "\u2014"}
                                        </Text>
                                        {has && item.uom ? (
                                          <Text
                                            style={[
                                              styles.qtyUnit,
                                              {
                                                color: isHigh
                                                  ? "#dc2626"
                                                  : isLow
                                                    ? "#ea580c"
                                                    : colors.onSurfaceVariant,
                                              },
                                            ]}
                                          >
                                            {item.uom + "/s"}
                                          </Text>
                                        ) : null}
                                      </View>
                                    );
                                  })}
                                </View>
                                <Divider />
                              </View>
                            );
                          })}
                        </View>
                      ));
                    })()}
                  </ScrollView>
                </View>
              </ScrollView>
            );
          }}
        </SearchFilterBar>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tableOuter: {
    flex: 1,
  },
  tableBodyScroll: {
    flex: 1,
  },
  supplierHeaderRow: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  supplierHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerCell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerDateTop: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  headerDateDay: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 1,
  },
  nameCol: {
    width: NAME_COL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  dateCol: {
    width: DATE_COL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: "#f3f4f6",
  },
  dataRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  altRow: {
    backgroundColor: "#f9fafb",
  },
  dataCell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  qtyCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
    paddingLeft: 8,
  },
  itemType: {
    fontSize: 11,
    marginTop: 1,
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  qtyUnit: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 1,
  },
});
