import DateSelector from "@/app/components/shared/DateSelector";
import SearchFilterBar, {
  SortOption,
} from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Supplier } from "@/models/Supplier";
import { useGetInventorySnapshotReport } from "@/services/useGetInventorySnapshotReport";
import { useStore } from "@/store/useStore";
import { format } from "date-fns";
import { router, Stack } from "expo-router";
import React, { memo, useMemo, useState } from "react";
import { RefreshControl, SectionList, View } from "react-native";
import {
  ActivityIndicator,
  Icon,
  IconButton,
  List,
  Text,
} from "react-native-paper";

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "quantity", label: "Quantity" },
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
      for (const supplierId of supplierIds) {
        if (!grouped.has(supplierId)) grouped.set(supplierId, []);
        grouped.get(supplierId)!.push(item);
      }
    } else {
      if (!grouped.has(null)) grouped.set(null, []);
      grouped.get(null)!.push(item);
    }
  }

  const sections: { title: string; supplierId: number | null; data: T[] }[] =
    [];
  for (const [supplierId, data] of grouped.entries()) {
    if (supplierId === null) continue;
    sections.push({
      title: supplierMap.get(supplierId) ?? `Supplier #${supplierId}`,
      supplierId,
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

type SnapshotTableItem = {
  id: number;
  itemId: number;
  name: string;
  typeId: number | null;
  type: string | null;
  uom: string | null;
  lastInventory: number;
  delivered: number;
  sold: number;
  qtyOnHand: number;
};

type SnapshotRowProps = {
  item: SnapshotTableItem;
};

function isSnapshotTableItem(
  row: SnapshotTableItem | null,
): row is SnapshotTableItem {
  return row !== null;
}

const SnapshotRow = memo(function SnapshotRow({ item }: SnapshotRowProps) {
  return (
    <List.Item
      title={item.name}
      titleNumberOfLines={1}
      description={
        item.uom
          ? () => <Text className="text-sm text-gray-400">UOM: {item.uom}</Text>
          : undefined
      }
      style={rowStyle}
      right={() => (
        <View className="flex-row items-center">
          <View className="w-16 items-center">
            <Text className="text-sm font-medium text-gray-600">
              {Number.isInteger(item.lastInventory)
                ? `${item.lastInventory}`
                : item.lastInventory.toFixed(2)}
            </Text>
          </View>
          <View className="w-16 items-center">
            <Text className="text-sm font-medium text-green-600">
              {item.delivered > 0
                ? Number.isInteger(item.delivered)
                  ? `+${item.delivered}`
                  : `+${item.delivered.toFixed(2)}`
                : "0"}
            </Text>
          </View>
          <View className="w-16 items-center">
            <Text className="text-sm font-medium text-gray-600">
              {item.sold > 0
                ? Number.isInteger(item.sold)
                  ? `${item.sold}`
                  : item.sold.toFixed(2)
                : "0"}
            </Text>
          </View>
          <View className="w-16 items-center">
            <Text className="text-sm font-bold">
              {Number.isInteger(item.qtyOnHand)
                ? `${item.qtyOnHand}`
                : item.qtyOnHand.toFixed(2)}
            </Text>
          </View>
        </View>
      )}
    />
  );
});

const rowStyle = { paddingVertical: 12, paddingHorizontal: 0 };

export default function InventorySnapshotReport() {
  const { colors } = useAppTheme();
  const items = useStore((s) => s.items);
  const suppliers = useStore((s) => s.suppliers);
  const supplierItems = useStore((s) => s.supplierItems);
  const [date, setDate] = useState(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  const {
    data: rawData = [],
    isLoading,
    isFetching,
    refetch,
    error,
  } = useGetInventorySnapshotReport(dateStr);

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

  const packSizeByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const item of items) {
      map[item.id] = item.packSize && item.packSize > 0 ? item.packSize : 1;
    }
    return map;
  }, [items]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Inventory Snapshot",
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
        <DateSelector value={date} onChange={setDate} />

        <SearchFilterBar placeholder="Search items" sortOptions={SORT_OPTIONS} showSupplierFilter suppliers={suppliers}>
          {(query, selectedType, selectedSupplierId, sortKey, sortDir) => {
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

            const mappedItems: Array<SnapshotTableItem | null> = rawData.map(
              (row) => {
                const item = items.find((it) => it.id === row.itemId);
                if (!item) return null;

                const packSize = packSizeByItemId[row.itemId] ?? 1;
                const sold = row.soldQty / packSize;
                const qtyOnHand =
                  row.lastInventoryQty + row.deliveredQty - sold;

                return {
                  id: row.itemId,
                  itemId: row.itemId,
                  name: item.name,
                  typeId: item.typeId ?? null,
                  type: item.type ?? null,
                  uom: item.packUom ?? null,
                  lastInventory: row.lastInventoryQty,
                  delivered: row.deliveredQty,
                  sold,
                  qtyOnHand,
                };
              },
            );

            let tableItems: SnapshotTableItem[] = mappedItems
              .filter(isSnapshotTableItem)
              .filter((row) => {
                const normalizedQuery = query.trim().toLowerCase();
                const matchesSupplier =
                  !selectedSupplierId ||
                  (itemSupplierMap[row.itemId] ?? []).includes(selectedSupplierId);
                return (
                  (!normalizedQuery ||
                    row.name.toLowerCase().includes(normalizedQuery)) &&
                  (!selectedType || row.typeId === selectedType) &&
                  matchesSupplier
                );
              });

            if (sortKey) {
              tableItems = [...tableItems].sort((a, b) => {
                const direction = sortDir === "asc" ? 1 : -1;
                switch (sortKey) {
                  case "name":
                    return direction * a.name.localeCompare(b.name);
                  case "type":
                    return (
                      direction * (a.type ?? "").localeCompare(b.type ?? "")
                    );
                  case "quantity":
                    return direction * (a.qtyOnHand - b.qtyOnHand);
                  default:
                    return 0;
                }
              });
            } else {
              tableItems = [...tableItems].sort((a, b) =>
                a.name.localeCompare(b.name),
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
                    No inventory snapshot found for this date
                  </Text>
                </View>
              );
            }

            const sections = buildSupplierSections(
              tableItems,
              (row) => row.itemId,
              suppliers,
              itemSupplierMap,
            );

            return (
              <View style={{ flex: 1 }}>
                <View className="flex-row px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <View className="flex-1" />
                  <Text className="w-16 text-xs font-semibold text-gray-400 text-center">
                    LAST{"\n"}INVENTORY
                  </Text>
                  <Text className="w-16 text-xs font-semibold text-gray-400 text-center">
                    DELIVERY{"\n"}DAY
                  </Text>
                  <Text className="w-16 text-xs font-semibold text-gray-400 text-center">
                    SOLD{"\n"}DAY
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
                    <RefreshControl
                      refreshing={isFetching}
                      onRefresh={refetch}
                    />
                  }
                  renderSectionHeader={({ section }) => (
                    <View className="px-4 py-1.5 bg-gray-100 border-b border-gray-200">
                      <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {section.title}
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => <SnapshotRow item={item} />}
                />
              </View>
            );
          }}
        </SearchFilterBar>
      </View>
    </>
  );
}
