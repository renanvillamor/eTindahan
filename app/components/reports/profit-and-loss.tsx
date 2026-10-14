import DateRangePicker from "@/app/components/shared/DateRangePicker";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { useGetProfitAndLossReport } from "@/services/useGetProfitAndLossReport";
import { format, startOfWeek } from "date-fns";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Icon, IconButton, Text } from "react-native-paper";

const MAX_DAYS = 31;

export default function ProfitAndLossReport() {
  const { colors } = useAppTheme();
  const today = new Date();
  const [fromDate, setFromDate] = useState(() => startOfWeek(today));
  const [toDate, setToDate] = useState(today);

  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");

  const { data, isLoading, isFetching, refetch, error } =
    useGetProfitAndLossReport(fromStr, toStr);

  const grossSales = data?.grossSales ?? 0;
  const cogs = data?.cogs ?? 0;
  const grossProfit = data?.grossProfit ?? 0;
  const operatingExpenses = data?.operatingExpenses ?? 0;
  const netProfit = data?.netProfit ?? 0;
  const isPositive = netProfit >= 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Profit & Loss",
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
          <DateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            maxDays={MAX_DAYS}
            onChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
            }}
          />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-400 text-sm">Loading…</Text>
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
            {/* ── SALES & COGS ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#DBEAFE" }]}>
                <Icon source="cash-register" size={16} color="#1D4ED8" />
                <Text style={[styles.cardHeaderText, { color: "#1D4ED8" }]}>
                  SALES
                </Text>
              </View>
              <View className="flex-row items-center justify-between px-4 py-3">
                <Text className="text-gray-700 text-sm">Gross Sales</Text>
                <Text className="text-gray-800 text-sm font-semibold">
                  {formatCurrency(grossSales)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between px-4 pb-3">
                <Text className="text-gray-700 text-sm">
                  Cost of Goods Sold
                </Text>
                <Text className="text-gray-800 text-sm font-semibold">
                  ({formatCurrency(cogs)})
                </Text>
              </View>
              <View style={[styles.totalRow, { backgroundColor: "#DBEAFE" }]}>
                <Text style={[styles.totalLabel, { color: "#1D4ED8" }]}>
                  GROSS PROFIT
                </Text>
                <Text style={[styles.totalValue, { color: "#1D4ED8" }]}>
                  {formatCurrency(grossProfit)}
                </Text>
              </View>
            </View>

            {/* ── OPERATING EXPENSES ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#FFEDD5" }]}>
                <Icon source="receipt-text-outline" size={16} color="#C2410C" />
                <Text style={[styles.cardHeaderText, { color: "#C2410C" }]}>
                  OPERATING EXPENSES
                </Text>
              </View>
              <Text className="text-gray-400 text-xs px-4 pt-3">
                Periodic opex (rent, salaries, etc.) is amortized
                proportionally across the days it covers that fall within
                this range.
              </Text>
              <View style={[styles.totalRow, { backgroundColor: "#FFEDD5" }]}>
                <Text style={[styles.totalLabel, { color: "#C2410C" }]}>
                  TOTAL OPERATING EXPENSES
                </Text>
                <Text style={[styles.totalValue, { color: "#C2410C" }]}>
                  {formatCurrency(operatingExpenses)}
                </Text>
              </View>
            </View>

            {/* ── NET PROFIT ── */}
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
                  NET PROFIT
                </Text>
              </View>
              <Text
                style={[
                  styles.netValue,
                  { color: isPositive ? "#15803D" : "#B91C1C" },
                ]}
              >
                {formatCurrency(netProfit)}
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
    marginTop: 8,
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
