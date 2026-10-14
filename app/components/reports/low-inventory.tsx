import SearchFilterBar, {
  SortOption,
} from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useInventoryActivity } from "@/hooks/useInventoryActivity";
import { useSnackbar } from "@/lib/SnackbarContext";
import { Inventory } from "@/models/Inventory";
import { Supplier } from "@/models/Supplier";
import { useGetDeliveries } from "@/services/useGetDeliveries";
import { useGetInventories } from "@/services/useGetInventories";
import { useGetSalesToday } from "@/services/useGetSalesToday";
import { useStore } from "@/store/useStore";
import { router, Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Dialog,
  Divider,
  Icon,
  IconButton,
  List,
  Portal,
  Text,
} from "react-native-paper";

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "qty", label: "Qty On Hand" },
];

type LowInvRow = {
  inventory: Inventory;
  onHand: number;
  minThreshold: number;
  orderQty: number | null;
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

// Suppliers only deliver whole packs, so round up (1.5 → 2, 0.25 → 1). The
// small epsilon keeps float noise (e.g. 2.0000000001) from bumping an exact
// whole number up by one.
function roundUpOrderQty(qty: number): number {
  return Math.ceil(qty - 1e-9);
}

// Shortfalls under half a pack aren't worth ordering yet.
const MIN_EXPORT_ORDER_QTY = 0.5;

// Rows with no computable Order Qty (no stockQuantity set) or an unrounded
// Order Qty under MIN_EXPORT_ORDER_QTY are excluded — nothing worth telling a
// supplier to order for them. Exported quantities are rounded up.
function buildExportText(rows: LowInvRow[]): string {
  return rows
    .filter(
      (row) => row.orderQty != null && row.orderQty >= MIN_EXPORT_ORDER_QTY,
    )
    .map(
      (row) =>
        `${row.inventory.name} - ${fmtQty(roundUpOrderQty(row.orderQty!))}`,
    )
    .join("\n");
}

export default function LowInventoryReport() {
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const [exportVisible, setExportVisible] = useState(false);
  const [exportText, setExportText] = useState("");
  // Populated during SearchFilterBar's render-prop each render, so the
  // header Export button (outside that scope) can read the currently
  // displayed (filtered + sorted) rows without lifting SearchFilterBar's
  // internal query/filter state up to this component.
  const displayedRowsRef = useRef<LowInvRow[]>([]);

  const inventories = useStore((s) => s.inventories);
  const items = useStore((s) => s.items);
  const suppliers = useStore((s) => s.suppliers);
  const supplierItems = useStore((s) => s.supplierItems);

  const { refetch, isFetching } = useGetInventories();
  // On-hand math (useInventoryActivity) needs today's sales/deliveries in the
  // store — without these, a user landing here without first visiting Home
  // or Add Delivery would see on-hand figures missing today's activity.
  useGetSalesToday();
  useGetDeliveries();
  const activityByItemId = useInventoryActivity();

  // itemId → minThreshold (from items store)
  const minThresholdByItemId = useMemo(() => {
    const map: Record<number, number | null> = {};
    for (const item of items) {
      map[item.id] = item.minThreshold;
    }
    return map;
  }, [items]);

  // itemId → stockQuantity (target par level, from items store)
  const stockQuantityByItemId = useMemo(() => {
    const map: Record<number, number | null> = {};
    for (const item of items) {
      map[item.id] = item.stockQuantity;
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
      // 0/unset both mean "no threshold configured" — don't flag every
      // out-of-stock item as low just because minThreshold defaults to 0.
      if (minThreshold == null || minThreshold <= 0) continue;
      const onHand = activityByItemId[inv.itemId]?.onHand ?? inv.actualQty ?? 0;
      if (onHand <= minThreshold) {
        const stockQuantity = stockQuantityByItemId[inv.itemId];
        // Unrounded shortfall, displayed as-is; only the export rounds it
        // up (roundUpOrderQty) and drops sub-half-pack shortfalls.
        const orderQty =
          stockQuantity != null ? Math.max(stockQuantity - onHand, 0) : null;
        rows.push({
          inventory: inv,
          onHand,
          minThreshold,
          orderQty,
        });
      }
    }
    return rows;
  }, [inventories, minThresholdByItemId, stockQuantityByItemId, activityByItemId]);

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
            <View className="flex-row items-center -mr-2">
              <IconButton
                icon="export-variant"
                size={22}
                onPress={() => {
                  setExportText(buildExportText(displayedRowsRef.current));
                  setExportVisible(true);
                }}
                accessibilityLabel="Export"
                className="m-0"
              />
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

            displayedRowsRef.current = filtered;

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
                  <Text className="w-24 pl-2 text-xs font-semibold text-gray-400 text-left uppercase">
                    Qty On Hand
                  </Text>
                  <Text className="w-24 pl-2 pr-4 text-xs font-semibold text-gray-400 text-left uppercase">
                    Order Qty
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
                          <View className="flex-row">
                            <View className="w-24 pl-2">
                              <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                style={[
                                  styles.qtyValue,
                                  { color: isOut ? "#dc2626" : "#ea580c" },
                                ]}
                              >
                                {fmtQty(row.onHand)}
                                {row.inventory.uom ? (
                                  <Text style={styles.uomInline}>
                                    {" "}
                                    {row.inventory.uom}/s
                                  </Text>
                                ) : null}
                              </Text>
                            </View>
                            <View className="w-24 pl-2 pr-4">
                              <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                style={styles.qtyValue}
                              >
                                {row.orderQty != null
                                  ? fmtQty(row.orderQty)
                                  : "—"}
                              </Text>
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

      <Portal>
        <Dialog
          visible={exportVisible}
          onDismiss={() => setExportVisible(false)}
        >
          <Dialog.Title>Export Low Inventory</Dialog.Title>
          <Dialog.Content>
            {exportText ? (
              <ScrollView style={styles.exportScroll}>
                <Text selectable style={styles.exportText}>
                  {exportText}
                </Text>
              </ScrollView>
            ) : (
              <Text className="text-gray-400">
                No items with a Stock Quantity set to export.
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setExportVisible(false)}>Close</Button>
            <Button
              mode="contained"
              disabled={!exportText}
              onPress={async () => {
                await Clipboard.setStringAsync(exportText);
                setExportVisible(false);
                showSnackbar("Copied to clipboard.", "success");
              }}
            >
              Copy
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    minHeight: 0,
  },
  outTitle: {
    color: "#dc2626",
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "left",
  },
  uomInline: {
    fontSize: 12,
    fontWeight: "400",
    color: "#9ca3af",
  },
  exportScroll: {
    maxHeight: 320,
  },
  exportText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
