import DateSelector from "@/app/components/shared/DateSelector";
import SearchFilterBar, {
  SortOption,
} from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Supplier } from "@/models/Supplier";
import { useGetInventoryVariance } from "@/services/useGetInventoryVariance";
import { useStore } from "@/store/useStore";
import { format } from "date-fns";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, IconButton, Text } from "react-native-paper";

const NAME_COL_WIDTH = 150;
const VAL_COL_WIDTH = 90;

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
];

function buildSupplierSections<T>(
  items: T[],
  getItemId: (item: T) => number,
  suppliers: Supplier[],
  itemSupplierMap: Record<number, number[]>,
): { title: string; supplierId: number | null; data: T[] }[] {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const grouped = new Map<number | null, T[]>();

  for (const item of items) {
    const itemId = getItemId(item);
    const supplierIds = itemSupplierMap[itemId];
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

  const sections: { title: string; supplierId: number | null; data: T[] }[] =
    [];
  for (const [sid, data] of grouped.entries()) {
    if (sid === null) continue;
    sections.push({
      title: supplierMap.get(sid) ?? `Supplier #${sid}`,
      supplierId: sid,
      data,
    });
  }
  sections.sort((a, b) => a.title.localeCompare(b.title));
  if (grouped.has(null)) {
    sections.push({
      title: "Other",
      supplierId: null,
      data: grouped.get(null)!,
    });
  }
  return sections;
}

type TableItem = {
  itemId: number;
  itemName: string;
  type: string | null;
  typeId: number | null;
  qtyOnHand: number;
  actualQty: number | null;
};

function fmtQty(val: number | null): string {
  if (val == null) return "—";
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

export default function InventoryVarianceReport() {
  const { colors } = useAppTheme();
  const storeItems = useStore((s) => s.items);
  const suppliers = useStore((s) => s.suppliers);
  const supplierItems = useStore((s) => s.supplierItems);

  const [date, setDate] = useState(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  const {
    data: rawData,
    isLoading,
    isFetching,
    refetch,
  } = useGetInventoryVariance(dateStr);

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

  const tableWidth = NAME_COL_WIDTH + VAL_COL_WIDTH * 2;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Inventory Variance",
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
        <DateSelector value={date} onChange={setDate} label="Inventory Date" />

        <SearchFilterBar
          placeholder="Search items..."
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

            // Build table rows
            let tableItems: TableItem[] = (rawData ?? []).map((row) => {
              const item = storeItems.find((it) => it.id === row.itemId);
              return {
                itemId: row.itemId,
                itemName: item?.name ?? `Item #${row.itemId}`,
                type: item?.type ?? null,
                typeId: item?.typeId ?? null,
                qtyOnHand: row.qtyOnHand,
                actualQty: row.actualQty,
              };
            });

            // Filter
            tableItems = tableItems.filter((row) => {
              const q = query.trim().toLowerCase();
              return (
                (!q || row.itemName.toLowerCase().includes(q)) &&
                (!selectedType || row.typeId === selectedType)
              );
            });

            // Sort
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
                    No inventory records found for this date
                  </Text>
                </View>
              );
            }

            // Group by supplier
            const sections = buildSupplierSections(
              tableItems,
              (it) => it.itemId,
              suppliers,
              itemSupplierMap,
            );

            return (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={styles.tableOuter}
                contentContainerStyle={{ minWidth: tableWidth, flexGrow: 1 }}
              >
                <View style={{ width: tableWidth, flex: 1 }}>
                  {/* Fixed column header */}
                  <View
                    style={[
                      styles.headerRow,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <View style={[styles.nameCol, styles.headerCell]}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        Item
                      </Text>
                    </View>
                    <View style={[styles.valCol, styles.headerCell]}>
                      <Text
                        style={[
                          styles.headerText,
                          { color: colors.primary, textAlign: "center" },
                        ]}
                      >
                        Qty on Hand
                      </Text>
                    </View>
                    <View style={[styles.valCol, styles.headerCell]}>
                      <Text
                        style={[
                          styles.headerText,
                          { color: colors.primary, textAlign: "center" },
                        ]}
                      >
                        Actual Qty
                      </Text>
                    </View>
                  </View>

                  {/* Scrollable body */}
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={styles.tableBodyScroll}
                  >
                    {sections.map((section) => (
                      <View key={section.supplierId ?? "other"}>
                        {/* Supplier header row */}
                        <View style={styles.supplierHeaderRow}>
                          <Text style={styles.supplierHeaderText}>
                            {section.title}
                          </Text>
                        </View>

                        {section.data.map((item, idx) => {
                          const variance =
                            item.actualQty != null
                              ? item.actualQty - item.qtyOnHand
                              : null;
                          const isOver = variance != null && variance > 0;
                          const isUnder = variance != null && variance < 0;

                          return (
                            <View key={item.itemId}>
                              <View
                                style={[
                                  styles.dataRow,
                                  idx % 2 === 1 && styles.altRow,
                                ]}
                              >
                                <View style={[styles.nameCol, styles.dataCell]}>
                                  <Text
                                    style={styles.itemName}
                                    numberOfLines={2}
                                  >
                                    {item.itemName}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.valCol,
                                    styles.dataCell,
                                    styles.centerCell,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.valText,
                                      { color: colors.onSurface },
                                    ]}
                                  >
                                    {fmtQty(item.qtyOnHand)}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.valCol,
                                    styles.dataCell,
                                    styles.centerCell,
                                    isOver
                                      ? styles.cellOver
                                      : isUnder
                                        ? styles.cellUnder
                                        : null,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.valText,
                                      {
                                        color: isOver
                                          ? "#15803d"
                                          : isUnder
                                            ? "#dc2626"
                                            : item.actualQty == null
                                              ? "#d1d5db"
                                              : colors.onSurface,
                                      },
                                    ]}
                                  >
                                    {fmtQty(item.actualQty)}
                                  </Text>
                                </View>
                              </View>
                              <Divider />
                            </View>
                          );
                        })}
                      </View>
                    ))}
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
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  nameCol: {
    width: NAME_COL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  valCol: {
    width: VAL_COL_WIDTH,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  centerCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  cellOver: {
    backgroundColor: "#f0fdf4",
  },
  cellUnder: {
    backgroundColor: "#fef2f2",
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
    paddingLeft: 4,
  },
  valText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  varianceText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 1,
  },
});
