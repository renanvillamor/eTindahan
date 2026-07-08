import SearchFilterBar, {
  SortOption,
} from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Inventory } from "@/models/Inventory";
import { Supplier } from "@/models/Supplier";
import { useGetInventories } from "@/services/useGetInventories";
import { useStore } from "@/store/useStore";
import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { Divider, Icon, IconButton, List, Text } from "react-native-paper";

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "qty", label: "Qty On Hand" },
];

type LowInvRow = {
  inventory: Inventory;
  onHand: number;
  minThreshold: number;
};

function buildSupplierSections(
  rows: LowInvRow[],
  getItemId: (row: LowInvRow) => number,
  suppliers: Supplier[],
  itemSupplierMap: Record<number, number[]>,
): { title: string; supplierId: number | null; data: LowInvRow[] }[] {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const grouped = new Map<number | null, LowInvRow[]>();

  for (const row of rows) {
    const itemId = getItemId(row);
    const supplierIds = itemSupplierMap[itemId];
    if (supplierIds && supplierIds.length > 0) {
      for (const sid of supplierIds) {
        if (!grouped.has(sid)) grouped.set(sid, []);
        grouped.get(sid)!.push(row);
      }
    } else {
      if (!grouped.has(null)) grouped.set(null, []);
      grouped.get(null)!.push(row);
    }
  }

  const sections: {
    title: string;
    supplierId: number | null;
    data: LowInvRow[];
  }[] = [];
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

function fmtQty(qty: number): string {
  return Number.isInteger(qty) ? `${qty}` : qty.toFixed(2);
}

export default function LowInventoryReport() {
  const { colors } = useAppTheme();

  const inventories = useStore((s) => s.inventories);
  const items = useStore((s) => s.items);
  const salesToday = useStore((s) => s.salesToday);
  const deliveries = useStore((s) => s.deliveries);
  const suppliers = useStore((s) => s.suppliers);
  const supplierItems = useStore((s) => s.supplierItems);

  const { refetch, isFetching } = useGetInventories();

  // itemId → packSize
  const packSizeByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const inv of inventories) {
      map[inv.itemId] = inv.packSize && inv.packSize > 0 ? inv.packSize : 1;
    }
    return map;
  }, [inventories]);

  // itemId → sold today (in pack UOM)
  const soldTodayByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of salesToday) {
      const packSize = packSizeByItemId[s.itemId] ?? 1;
      map[s.itemId] = (map[s.itemId] ?? 0) + s.quantity / packSize;
    }
    return map;
  }, [salesToday, packSizeByItemId]);

  // itemId → delivered today (in pack UOM)
  const deliveredTodayByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const d of deliveries) {
      if (d.itemId == null) continue;
      map[d.itemId] = (map[d.itemId] ?? 0) + d.quantity;
    }
    return map;
  }, [deliveries]);

  // itemId → minThreshold (from items store)
  const minThresholdByItemId = useMemo(() => {
    const map: Record<number, number | null> = {};
    for (const item of items) {
      map[item.id] = item.minThreshold;
    }
    return map;
  }, [items]);

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

  // All low-inventory rows
  const allLowRows = useMemo<LowInvRow[]>(() => {
    const rows: LowInvRow[] = [];
    for (const inv of inventories) {
      const minThreshold = minThresholdByItemId[inv.itemId];
      if (minThreshold == null) continue;
      const onHand =
        (inv.actualQty ?? 0) +
        (deliveredTodayByItemId[inv.itemId] ?? 0) -
        (soldTodayByItemId[inv.itemId] ?? 0);
      if (onHand <= minThreshold) {
        rows.push({
          inventory: inv,
          onHand,
          minThreshold,
        });
      }
    }
    return rows;
  }, [
    inventories,
    minThresholdByItemId,
    deliveredTodayByItemId,
    soldTodayByItemId,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Low Inventory",
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

      <View className="flex-1 bg-white pt-8">
        <SearchFilterBar
          placeholder="Search items..."
          sortOptions={SORT_OPTIONS}
          showSupplierFilter
          suppliers={suppliers}
        >
          {(query, selectedType, selectedSupplierId, sortKey, sortDir) => {
            let filtered = allLowRows.filter((row) => {
              const q = query.trim().toLowerCase();
              const matchesSupplier =
                !selectedSupplierId ||
                (itemSupplierMap[row.inventory.itemId] ?? []).includes(selectedSupplierId);
              return (
                (!q || (row.inventory.name ?? "").toLowerCase().includes(q)) &&
                (!selectedType || row.inventory.typeId === selectedType) &&
                matchesSupplier
              );
            });

            if (sortKey) {
              filtered = [...filtered].sort((a, b) => {
                const dir = sortDir === "asc" ? 1 : -1;
                switch (sortKey) {
                  case "name":
                    return (
                      dir *
                      (a.inventory.name ?? "").localeCompare(
                        b.inventory.name ?? "",
                      )
                    );
                  case "type":
                    return (
                      dir *
                      (a.inventory.type ?? "").localeCompare(
                        b.inventory.type ?? "",
                      )
                    );
                  case "qty":
                    return dir * (a.onHand - b.onHand);
                  default:
                    return 0;
                }
              });
            } else {
              filtered = [...filtered].sort((a, b) =>
                (a.inventory.name ?? "").localeCompare(b.inventory.name ?? ""),
              );
            }

            const sections = buildSupplierSections(
              filtered,
              (row) => row.inventory.itemId,
              suppliers,
              itemSupplierMap,
            );

            if (allLowRows.length === 0 && !isFetching) {
              return (
                <View className="flex-1 items-center justify-center py-16 gap-2">
                  <Icon
                    source="check-circle-outline"
                    size={48}
                    color="#86efac"
                  />
                  <Text className="text-gray-500 font-semibold text-base">
                    All items are sufficiently stocked
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    No items are at or below their minimum threshold.
                  </Text>
                </View>
              );
            }

            if (filtered.length === 0) {
              return (
                <View className="flex-1 items-center justify-center py-16 gap-2">
                  <Icon source="magnify-close" size={40} color="#d1d5db" />
                  <Text className="text-gray-400">No matching items</Text>
                </View>
              );
            }

            return (
              <View style={{ flex: 1 }}>
                {/* Column header */}
                <View className="flex-row px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <Text className="flex-1 text-xs font-semibold text-gray-400 uppercase">
                    {""}
                  </Text>
                  <Text className="w-20 text-xs font-semibold text-gray-400 text-center uppercase">
                    Qty On Hand
                  </Text>
                </View>

                <SectionList
                  sections={sections}
                  keyExtractor={(row) => row.inventory.id.toString()}
                  refreshControl={
                    <RefreshControl
                      refreshing={isFetching}
                      onRefresh={refetch}
                    />
                  }
                  ItemSeparatorComponent={() => <Divider />}
                  renderSectionHeader={({ section }) => (
                    <View className="px-4 py-1.5 bg-gray-100 border-b border-gray-200">
                      <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {section.title}
                      </Text>
                    </View>
                  )}
                  renderItem={({ item: row }) => {
                    const isOut = row.onHand <= 0;
                    return (
                      <List.Item
                        title={row.inventory.name}
                        titleNumberOfLines={1}
                        style={styles.listItem}
                        right={() => (
                          <View className="flex-row items-center pr-2">
                            <View className="w-20 items-center">
                              <Text
                                style={[
                                  styles.qtyValue,
                                  { color: isOut ? "#dc2626" : "#ea580c" },
                                ]}
                              >
                                {fmtQty(row.onHand)}
                              </Text>
                              {row.inventory.uom ? (
                                <Text style={styles.uomLabel}>
                                  {row.inventory.uom}/s
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        )}
                      />
                    );
                  }}
                />
              </View>
            );
          }}
        </SearchFilterBar>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  outTitle: {
    color: "#dc2626",
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  uomLabel: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 1,
  },
});
