import SearchFilterBar from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import useSafePush from "@/lib/useSafePush";
import { Inventory } from "@/models/Inventory";
import { Supplier } from "@/models/Supplier";
import { useGetInventories } from "@/services/useGetInventories";
import React, { memo, useMemo, useState } from "react";
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FAB, List } from "react-native-paper";
import { useStore } from "../../store/useStore";

/** Shared helper: groups a list of items into supplier sections */
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
  // Supplier sections in name order
  for (const [sid, data] of grouped.entries()) {
    if (sid === null) continue;
    sections.push({
      title: supplierMap.get(sid) ?? `Supplier #${sid}`,
      supplierId: sid,
      data,
    });
  }
  sections.sort((a, b) => a.title.localeCompare(b.title));
  // "Other" at the end
  if (grouped.has(null)) {
    sections.push({
      title: "Other",
      supplierId: null,
      data: grouped.get(null)!,
    });
  }
  return sections;
}

type InventoryRowProps = { item: Inventory; soldToday: number };

const InventoryRow = memo(function InventoryRow({
  item,
  soldToday,
}: InventoryRowProps) {
  const lastInv = item.actualQty ?? 0;
  const onHand = lastInv - soldToday;
  return (
    <List.Item
      title={item.name}
      titleNumberOfLines={1}
      description={
        item.uom
          ? () => <Text className="text-sm text-gray-400">UOM: {item.uom}</Text>
          : undefined
      }
      style={invRowStyle}
      right={() => (
        <View className="flex-row items-center">
          <View className="w-16 items-center">
            <Text className="text-sm font-medium text-gray-600">
              {Number.isInteger(lastInv) ? `${lastInv}` : lastInv.toFixed(2)}
            </Text>
          </View>
          <View className="w-16 items-center">
            <Text className="text-sm font-medium text-gray-600">
              {soldToday > 0
                ? Number.isInteger(soldToday)
                  ? `${soldToday}`
                  : soldToday.toFixed(2)
                : "0"}
            </Text>
          </View>
          <View className="w-16 items-center">
            <Text className="text-sm font-bold">
              {Number.isInteger(onHand) ? `${onHand}` : onHand.toFixed(2)}
            </Text>
          </View>
        </View>
      )}
    />
  );
});

const invRowStyle = { paddingVertical: 12, paddingHorizontal: 0 };

export default function InventoryScreen() {
  const { colors } = useAppTheme();
  const inventories = useStore((state) => state.inventories);
  const salesToday = useStore((state) => state.salesToday);
  const suppliers = useStore((s) => s.suppliers);
  const supplierItems = useStore((s) => s.supplierItems);
  const [fabOpen, setFabOpen] = useState(false);

  const styles = useStyles(colors);
  const safePush = useSafePush();
  const { refetch, isFetching } = useGetInventories();

  // itemId → packSize (how many singles make one pack), sourced directly from inventory fetch
  const packSizeByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const inv of inventories) {
      map[inv.itemId] = inv.packSize && inv.packSize > 0 ? inv.packSize : 1;
    }
    return map;
  }, [inventories]);

  // Map itemId → total qty sold today converted to pack UOM
  const soldTodayByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of salesToday) {
      const packSize = packSizeByItemId[s.itemId] ?? 1;
      const soldInPacks = s.quantity / packSize;
      map[s.itemId] = (map[s.itemId] ?? 0) + soldInPacks;
    }
    return map;
  }, [salesToday, packSizeByItemId]);

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

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-16 pb-2 items-center">
        <Text className="text-2xl font-bold text-gray-800">
          Latest Inventory
        </Text>
      </View>

      <SearchFilterBar placeholder="Search items">
        {(query, selectedType, sortKey, sortDir) => {
          let filtered = inventories.filter((it) => {
            const q = query.trim().toLowerCase();
            return (
              (!q || (it.name || "").toLowerCase().includes(q)) &&
              (!selectedType || it.typeId === selectedType)
            );
          });
          if (sortKey) {
            filtered = [...filtered].sort((a, b) => {
              const dir = sortDir === "asc" ? 1 : -1;
              switch (sortKey) {
                case "name":
                  return dir * (a.name ?? "").localeCompare(b.name ?? "");
                case "type":
                  return dir * (a.type ?? "").localeCompare(b.type ?? "");
                case "quantity": {
                  const aQty = a.qtyOnHand - (soldTodayByItemId[a.itemId] ?? 0);
                  const bQty = b.qtyOnHand - (soldTodayByItemId[b.itemId] ?? 0);
                  return dir * (aQty - bQty);
                }
                default:
                  return 0;
              }
            });
          } else {
            filtered = [...filtered].sort((a, b) =>
              (a.name ?? "").localeCompare(b.name ?? ""),
            );
          }

          // Group by supplier
          const sections = buildSupplierSections(
            filtered,
            (inv) => inv.itemId,
            suppliers,
            itemSupplierMap,
          );

          return (
            <View style={{ flex: 1 }}>
              {/* Sticky column header */}
              <View className="flex-row px-4 py-2 bg-gray-50 border-b border-gray-200">
                <Text className="flex-1 text-xs font-semibold text-gray-400"></Text>
                <Text className="w-17 text-xs font-semibold text-gray-400 text-center">
                  LAST{"\n"}INVENTORY
                </Text>
                <Text className="w-16 text-xs font-semibold text-gray-400 text-center">
                  SOLD{"\n"}TODAY
                </Text>
                <Text className="w-16 text-xs font-semibold text-gray-400 text-center">
                  QTY ON{"\n"}HAND
                </Text>
              </View>

              <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                ItemSeparatorComponent={() => (
                  <View className="h-px bg-gray-200" />
                )}
                refreshControl={
                  <RefreshControl refreshing={isFetching} onRefresh={refetch} />
                }
                renderSectionHeader={({ section }) => (
                  <View className="px-4 py-1.5 bg-gray-100 border-b border-gray-200">
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {section.title}
                    </Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <InventoryRow
                    item={item}
                    soldToday={soldTodayByItemId[item.itemId] ?? 0}
                  />
                )}
              />
            </View>
          );
        }}
      </SearchFilterBar>

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? "close" : "dots-vertical"}
        color="white"
        fabStyle={styles.fab}
        onStateChange={({ open }) => setFabOpen(open)}
        actions={[
          {
            icon: "truck-delivery-outline",
            label: "Deliveries",
            onPress: () => safePush("/components/inventory/delivery"),
            color: "white",
            style: styles.actionFab,
          },
          {
            icon: "package-variant-plus",
            label: "Add Inventory",
            onPress: () => safePush("/components/inventory/add-inventory"),
            color: "white",
            style: styles.actionFab,
          },
        ]}
      />
    </View>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    fab: {
      borderRadius: 28,
      backgroundColor: colors.primary,
    },
    actionFab: {
      borderRadius: 28,
      backgroundColor: colors.primary,
    },
    listItem: {
      paddingVertical: 12,
      paddingHorizontal: 0,
    },
  });
