import { CARD_COLORS } from "@/constants/Constants";
import { formatCurrency } from "@/lib/utils";
import { SaleToday } from "@/models/SaleToday";
import { useGetSalesToday } from "@/services/useGetSalesToday";
import { useStore } from "@/store/useStore";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text as RNText,
  StyleSheet,
  View,
} from "react-native";
import { Card, Divider, List, Text } from "react-native-paper";

export default function DashboardScreen() {
  const {
    data: dbSales = [],
    isFetching,
    refetch,
    isSuccess,
  } = useGetSalesToday();
  const sales = useStore((s) => s.salesToday);
  const setSalesToday = useStore((s) => s.setSalesToday);

  useEffect(() => {
    if (isSuccess) {
      setSalesToday(dbSales);
    }
  }, [dbSales, isSuccess, setSalesToday]);

  const sorted = useMemo(
    () =>
      [...sales].sort((a, b) =>
        b.transactionDate.localeCompare(a.transactionDate),
      ),
    [sales],
  );

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sales) {
      const key = s.type ?? "Uncategorized";
      map[key] = (map[key] ?? 0) + s.total;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sales]);

  const grandTotal = useMemo(
    () => sales.reduce((sum, s) => sum + s.total, 0),
    [sales],
  );

  const [activeType, setActiveType] = useState<string | null>(null);

  const displayedSales = useMemo(
    () =>
      activeType
        ? sorted.filter((s) => (s.type ?? "Uncategorized") === activeType)
        : sorted,
    [sorted, activeType],
  );

  const renderItem = ({ item }: { item: SaleToday }) => {
    const timeLabel = item.transactionDate
      ? format(new Date(item.transactionDate), "h:mm a")
      : null;
    const isUnsynced = item.synced === false;

    return (
      <View className={isUnsynced ? "bg-red-300" : ""}>
        <List.Item
          title={item.name}
          titleNumberOfLines={1}
          description={() => (
            <RNText className="text-xs text-gray-500">{timeLabel ?? ""}</RNText>
          )}
          descriptionNumberOfLines={1}
          style={[styles.listItem]}
          right={() => (
            <View style={styles.totalWrapper}>
              <RNText className="text-md font-semibold text-gray-800">
                {formatCurrency(item.total)}
              </RNText>
              <RNText
                className="text-sm text-gray-400 mt-0.5"
                numberOfLines={1}
              >
                {formatCurrency(item.price)} × {item.quantity} {item.uom ?? ""}
              </RNText>
            </View>
          )}
        />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Static header */}
      <View className="pt-12">
        <RNText className="text-4xl font-bold text-gray-800 text-center mt-4">
          RGM Trading
        </RNText>

        {/* Grand total */}
        <View className="px-4 pt-3 pb-4 items-center">
          <RNText className="text-xs text-gray-500 mb-1 w-full text-center">
            TOTAL SALES TODAY
          </RNText>
          <RNText className="text-2xl font-bold text-gray-800">
            {formatCurrency(grandTotal)}
          </RNText>
        </View>

        {/* Per-type cards */}
        {byType.length > 0 && (
          <View className="px-4 pb-4">
            <View className="flex-row flex-wrap gap-3">
              {byType.map(([type, total], index) => {
                const isSelected = activeType === type;
                const isDimmed = activeType !== null && !isSelected;
                return (
                  <Card
                    key={type}
                    onPress={() =>
                      setActiveType((t) => (t === type ? null : type))
                    }
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor:
                          CARD_COLORS[index % CARD_COLORS.length],
                        opacity: isDimmed ? 0.45 : 1,
                        borderWidth: isSelected ? 2.5 : 0,
                        borderColor: "white",
                      },
                    ]}
                  >
                    <Card.Content className="items-center py-3 px-4">
                      <RNText style={styles.cardTypeLabel}>
                        {isSelected ? "✓  " : ""}
                        {type}
                      </RNText>
                      <RNText style={styles.cardTypeTotal}>
                        {formatCurrency(total)}
                      </RNText>
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        <Divider />
      </View>

      {/* Scrollable list only */}
      <FlatList
        data={displayedSales}
        keyExtractor={(item) => String(item.id)}
        style={{ flex: 1 }}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-200" />}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          !isFetching ? (
            <View className="items-center justify-center py-16">
              <Text className="text-gray-400">No sales recorded today</Text>
            </View>
          ) : null
        }
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  typeCard: {
    minWidth: 120,
    flex: 1,
  },
  cardTypeLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  cardTypeTotal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  listItem: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  totalWrapper: {
    justifyContent: "center",
    alignItems: "flex-end",
    minWidth: 140,
    maxWidth: 160,
    paddingRight: 8,
  },
});
