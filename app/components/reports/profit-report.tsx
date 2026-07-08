import SearchFilterBar, {
  SortOption,
} from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Divider, Icon, IconButton, Text } from "react-native-paper";

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "profit", label: "Profit" },
];

export default function ProfitReport() {
  const { colors } = useAppTheme();
  const items = useStore((s) => s.items);

  const profitRows = useMemo(() => {
    return items.map((item) => ({
      ...item,
      profit: item.retailPrice - item.supplierUnitPrice,
    }));
  }, [items]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Profit Report",
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
        }}
      />

      <View className="flex-1 bg-white pt-4">
        <SearchFilterBar
          placeholder="Search items..."
          sortOptions={SORT_OPTIONS}
        >
          {(query, selectedType, selectedSupplierId, sortKey, sortDir) => {
            let rows = profitRows.filter((it) => {
              const q = query.trim().toLowerCase();
              return (
                (!q || it.name.toLowerCase().includes(q)) &&
                (!selectedType || it.typeId === selectedType)
              );
            });

            if (sortKey) {
              rows = [...rows].sort((a, b) => {
                const dir = sortDir === "asc" ? 1 : -1;
                switch (sortKey) {
                  case "name":
                    return dir * a.name.localeCompare(b.name);
                  case "type":
                    return dir * (a.type ?? "").localeCompare(b.type ?? "");
                  case "profit":
                    return dir * (a.profit - b.profit);
                  default:
                    return 0;
                }
              });
            } else {
              rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
            }

            if (rows.length === 0) {
              return (
                <View className="flex-1 items-center justify-center py-16 gap-2">
                  <Icon source="chart-bar-off" size={40} color="#d1d5db" />
                  <Text className="text-gray-400">No items found</Text>
                </View>
              );
            }

            return (
              <FlatList
                data={rows}
                keyExtractor={(item) => item.id.toString()}
                ItemSeparatorComponent={() => <Divider />}
                ListHeaderComponent={
                  <View
                    style={[
                      styles.headerRow,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <View style={styles.nameCol}></View>
                    <View style={styles.priceCol}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        SUPPLIER
                      </Text>
                    </View>
                    <View style={styles.priceCol}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        RETAIL
                      </Text>
                    </View>
                    <View style={styles.priceCol}>
                      <Text
                        style={[styles.headerText, { color: colors.primary }]}
                      >
                        PROFIT
                      </Text>
                    </View>
                  </View>
                }
                renderItem={({ item, index }) => {
                  const profitColor =
                    item.profit > 0
                      ? "#16a34a"
                      : item.profit < 0
                        ? "#dc2626"
                        : "#6b7280";
                  return (
                    <View
                      style={[styles.dataRow, index % 2 === 1 && styles.altRow]}
                    >
                      <View style={styles.nameCol}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name}
                        </Text>
                      </View>
                      <View style={styles.priceCol}>
                        <Text style={styles.priceValue}>
                          {formatCurrency(item.supplierUnitPrice)}
                        </Text>
                      </View>
                      <View style={styles.priceCol}>
                        <Text style={styles.priceValue}>
                          {formatCurrency(item.retailPrice)}
                        </Text>
                      </View>
                      <View style={styles.priceCol}>
                        <Text
                          style={[styles.profitValue, { color: profitColor }]}
                        >
                          {formatCurrency(item.profit)}
                        </Text>
                      </View>
                    </View>
                  );
                }}
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
  nameCol: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  priceCol: {
    width: 82,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dataRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 46,
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
  itemType: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  priceHint: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 1,
  },
  profitValue: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
