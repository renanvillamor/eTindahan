import DateSelector from "@/app/components/shared/DateSelector";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import {
  PayableStandingRow,
  UnremittedDayRow,
  useGetFinancialStandingReport,
} from "@/services/useGetFinancialStandingReport";
import { useStore } from "@/store/useStore";
import { format, isAfter, parseISO, startOfDay } from "date-fns";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Icon, IconButton, Text } from "react-native-paper";

type TypeValueRow = {
  key: string;
  label: string;
  value: number;
};

export default function FinancialStandingReport() {
  const { colors } = useAppTheme();
  const items = useStore((s) => s.items);

  const today = startOfDay(new Date());
  const [date, setDate] = useState(today);
  const dateStr = format(date, "yyyy-MM-dd");
  const isFuture = isAfter(startOfDay(date), today);

  const handleDateChange = (d: Date) => {
    if (isAfter(startOfDay(d), today)) return;
    setDate(d);
  };

  const { data, isLoading, isFetching, refetch, error } =
    useGetFinancialStandingReport(dateStr, !isFuture);

  const itemById = useMemo(
    () => new Map(items.map((it) => [it.id, it])),
    [items],
  );

  // Inventory value (at cost) grouped by item type
  const inventoryByType = useMemo<TypeValueRow[]>(() => {
    const agg = new Map<string, TypeValueRow>();
    for (const row of data?.inventory ?? []) {
      const item = itemById.get(row.itemId);
      const label = item?.type ?? "Uncategorized";
      const key = item?.typeId != null ? String(item.typeId) : "null";
      const cost = item?.supplierPrice ?? 0;
      const value = row.actualQty * cost;
      const existing = agg.get(key);
      if (existing) {
        existing.value += value;
      } else {
        agg.set(key, { key, label, value });
      }
    }
    return Array.from(agg.values()).sort((a, b) => {
      if (a.label === "Uncategorized") return 1;
      if (b.label === "Uncategorized") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [data?.inventory, itemById]);

  const totalInventoryValue = useMemo(
    () => inventoryByType.reduce((sum, r) => sum + r.value, 0),
    [inventoryByType],
  );

  // Payables grouped by supplier
  const payablesBySupplier = useMemo<TypeValueRow[]>(() => {
    const agg = new Map<string, TypeValueRow>();
    for (const row of data?.payables ?? []) {
      const key = row.payeeId != null ? String(row.payeeId) : "null";
      const label = row.payeeName ?? "Unassigned";
      const existing = agg.get(key);
      if (existing) {
        existing.value += row.amount;
      } else {
        agg.set(key, { key, label, value: row.amount });
      }
    }
    return Array.from(agg.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [data?.payables]);

  const totalPayables = useMemo(
    () => payablesBySupplier.reduce((sum, r) => sum + r.value, 0),
    [payablesBySupplier],
  );

  const unremittedDays: UnremittedDayRow[] = data?.unremittedDays ?? [];
  const totalUnremittedNetSales = useMemo(
    () => unremittedDays.reduce((sum, d) => sum + d.netSales, 0),
    [unremittedDays],
  );
  const totalUnremittedOpex = useMemo(
    () => unremittedDays.reduce((sum, d) => sum + d.totalOpex, 0),
    [unremittedDays],
  );

  const remittedFunds = data?.remittedFunds;
  const totalRemittedFunds = remittedFunds?.total ?? 0;

  const overallNet =
    totalInventoryValue +
    totalUnremittedNetSales +
    totalRemittedFunds -
    totalPayables;
  const isPositive = overallNet >= 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Financial Standing",
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

      <View className="flex-1 bg-gray-50">
        <View className="bg-white border-b border-gray-100">
          <DateSelector value={date} onChange={handleDateChange} />
        </View>

        {isFuture ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Icon source="calendar-alert" size={48} color="#d1d5db" />
            <Text className="text-gray-400 text-center">
              Financial standing isn't available for future dates.
            </Text>
          </View>
        ) : isLoading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-400 text-sm">Loading standing…</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Icon source="alert-circle-outline" size={48} color="#ef4444" />
            <Text className="text-red-400 text-center">{error.message}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── INVENTORY VALUE ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#E0E7FF" }]}>
                <Icon source="archive-outline" size={16} color="#4338CA" />
                <Text style={[styles.cardHeaderText, { color: "#4338CA" }]}>
                  INVENTORY VALUE (AT COST)
                </Text>
              </View>

              {inventoryByType.length === 0 ? (
                <View className="flex-row items-center justify-center gap-2 py-8">
                  <Icon source="package-variant" size={22} color="#d1d5db" />
                  <Text className="text-gray-400 text-sm">
                    No inventory counted yet
                  </Text>
                </View>
              ) : (
                inventoryByType.map((row) => (
                  <View className="py-1" key={row.key}>
                    <View className="flex-row items-center justify-between px-4 py-1">
                      <Text className="text-gray-700 text-sm flex-1 mr-4">
                        {row.label}
                      </Text>
                      <Text className="text-gray-800 text-sm font-semibold">
                        {formatCurrency(row.value)}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <View style={[styles.totalRow, { backgroundColor: "#E0E7FF" }]}>
                <Text style={[styles.totalLabel, { color: "#4338CA" }]}>
                  TOTAL INVENTORY VALUE
                </Text>
                <Text style={[styles.totalValue, { color: "#4338CA" }]}>
                  {formatCurrency(totalInventoryValue)}
                </Text>
              </View>
            </View>

            {/* ── PAYABLES ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#FEE2E2" }]}>
                <Icon source="hand-coin-outline" size={16} color="#B91C1C" />
                <Text style={[styles.cardHeaderText, { color: "#B91C1C" }]}>
                  PAYABLES
                </Text>
              </View>

              {payablesBySupplier.length === 0 ? (
                <View className="flex-row items-center justify-center gap-2 py-8">
                  <Icon source="check-circle-outline" size={22} color="#d1d5db" />
                  <Text className="text-gray-400 text-sm">
                    No outstanding payables
                  </Text>
                </View>
              ) : (
                payablesBySupplier.map((row) => (
                  <View className="py-1" key={row.key}>
                    <View className="flex-row items-center justify-between px-4 py-1">
                      <Text className="text-gray-700 text-sm flex-1 mr-4">
                        {row.label}
                      </Text>
                      <Text className="text-gray-800 text-sm font-semibold">
                        {formatCurrency(row.value)}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <View style={[styles.totalRow, { backgroundColor: "#FEE2E2" }]}>
                <Text style={[styles.totalLabel, { color: "#B91C1C" }]}>
                  TOTAL PAYABLES
                </Text>
                <Text style={[styles.totalValue, { color: "#B91C1C" }]}>
                  {formatCurrency(totalPayables)}
                </Text>
              </View>
            </View>

            {/* ── UNREMITTED NET SALES ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#DBEAFE" }]}>
                <Icon source="cash-clock" size={16} color="#1D4ED8" />
                <Text style={[styles.cardHeaderText, { color: "#1D4ED8" }]}>
                  UNREMITTED NET SALES
                </Text>
              </View>

              {unremittedDays.length === 0 ? (
                <View className="flex-row items-center justify-center gap-2 py-8">
                  <Icon source="check-circle-outline" size={22} color="#d1d5db" />
                  <Text className="text-gray-400 text-sm">
                    Everything has been remitted
                  </Text>
                </View>
              ) : (
                unremittedDays.map((row) => (
                  <View className="py-1" key={row.date}>
                    <View className="flex-row items-center justify-between px-4 py-1">
                      <Text className="text-gray-700 text-sm flex-1 mr-4">
                        {format(parseISO(row.date), "MMM d, yyyy")}
                      </Text>
                      <Text className="text-gray-800 text-sm font-semibold">
                        {formatCurrency(row.netSales)}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              {totalUnremittedOpex > 0 && (
                <View className="flex-row items-center justify-between px-4 pb-1">
                  <Text className="text-xs text-gray-400">
                    Includes operating expenses
                  </Text>
                  <Text className="text-xs text-gray-500 font-medium">
                    {formatCurrency(totalUnremittedOpex)}
                  </Text>
                </View>
              )}

              <View style={[styles.totalRow, { backgroundColor: "#DBEAFE" }]}>
                <Text style={[styles.totalLabel, { color: "#1D4ED8" }]}>
                  TOTAL UNREMITTED NET SALES
                </Text>
                <Text style={[styles.totalValue, { color: "#1D4ED8" }]}>
                  {formatCurrency(totalUnremittedNetSales)}
                </Text>
              </View>
            </View>

            {/* ── REMITTED FUNDS ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#DCFCE7" }]}>
                <Icon source="bank-outline" size={16} color="#15803D" />
                <Text style={[styles.cardHeaderText, { color: "#15803D" }]}>
                  REMITTED FUNDS
                </Text>
              </View>

              {[
                {
                  key: "remitted",
                  label: "Remitted net sales",
                  value: remittedFunds?.remittedNetSales ?? 0,
                },
                {
                  key: "delivery",
                  label: "Less: non-cash delivery payments",
                  value: -(remittedFunds?.nonCashDeliveryPayments ?? 0),
                },
                {
                  key: "payable",
                  label: "Less: non-cash payable payments",
                  value: -(remittedFunds?.nonCashPayablePayments ?? 0),
                },
              ].map((row) => (
                <View className="py-1" key={row.key}>
                  <View className="flex-row items-center justify-between px-4 py-1">
                    <Text className="text-gray-700 text-sm flex-1 mr-4">
                      {row.label}
                    </Text>
                    <Text className="text-gray-800 text-sm font-semibold">
                      {formatCurrency(row.value)}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={[styles.totalRow, { backgroundColor: "#DCFCE7" }]}>
                <Text style={[styles.totalLabel, { color: "#15803D" }]}>
                  TOTAL REMITTED FUNDS
                </Text>
                <Text style={[styles.totalValue, { color: "#15803D" }]}>
                  {formatCurrency(totalRemittedFunds)}
                </Text>
              </View>
            </View>

            {/* ── OVERALL NET ── */}
            <View
              style={[
                styles.netCard,
                isPositive
                  ? { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }
                  : { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
              ]}
            >
              <View className="flex-row items-center gap-2">
                <Icon
                  source={isPositive ? "trending-up" : "trending-down"}
                  size={20}
                  color={isPositive ? "#16A34A" : "#DC2626"}
                />
                <Text
                  style={[
                    styles.netLabel,
                    { color: isPositive ? "#15803D" : "#B91C1C" },
                  ]}
                >
                  OVERALL NET
                </Text>
              </View>
              <Text
                style={[
                  styles.netValue,
                  { color: isPositive ? "#15803D" : "#B91C1C" },
                ]}
              >
                {formatCurrency(overallNet)}
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  cardHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  netCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  netValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
});
