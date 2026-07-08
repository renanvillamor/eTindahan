import DateSelector from "@/app/components/shared/DateSelector";
import TagBar from "@/app/components/shared/TagBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import {
  DailyExpenseRow,
  DailySalesTypeRow,
  useGetDailySummaryReport,
} from "@/services/useGetDailySummaryReport";
import { format, isAfter, startOfDay } from "date-fns";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Icon, IconButton, Text } from "react-native-paper";

export default function DailySummaryReport() {
  const { colors } = useAppTheme();
  const today = startOfDay(new Date());
  const [date, setDate] = useState(today);
  const dateStr = format(date, "yyyy-MM-dd");

  const { data, isLoading, isFetching, refetch, error } =
    useGetDailySummaryReport(dateStr);

  const handleDateChange = (d: Date) => {
    if (isAfter(startOfDay(d), today)) return;
    setDate(d);
  };

  const net = data?.netBalance ?? 0;
  const isPositive = net >= 0;
  const totalSales = data?.totalSales ?? 0;
  const totalExpenses = data?.totalExpenses ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Daily Summary",
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
        {/* Date navigation */}
        <View className="bg-white border-b border-gray-100">
          <DateSelector value={date} onChange={handleDateChange} />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-gray-400 text-sm">Loading summary…</Text>
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
            {/* ── SALES ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#DBEAFE" }]}>
                <Icon source="cash-register" size={16} color="#1D4ED8" />
                <Text style={[styles.cardHeaderText, { color: "#1D4ED8" }]}>
                  SALES
                </Text>
              </View>

              {(data?.salesByType.length ?? 0) === 0 ? (
                <View className="flex-row items-center justify-center gap-2 py-8">
                  <Icon source="cart-off" size={22} color="#d1d5db" />
                  <Text className="text-gray-400 text-sm">
                    No sales recorded
                  </Text>
                </View>
              ) : (
                data!.salesByType.map((row: DailySalesTypeRow, idx) => (
                  <View className="py-1" key={String(row.typeId ?? "null")}>
                    <View className="flex-row items-center justify-between px-4 py-1">
                      <Text className="text-gray-700 text-sm flex-1 mr-4">
                        {row.typeName}
                      </Text>
                      <Text className="text-gray-800 text-sm font-semibold">
                        {formatCurrency(row.totalSales)}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              <View style={[styles.totalRow, { backgroundColor: "#DBEAFE" }]}>
                <Text style={[styles.totalLabel, { color: "#1D4ED8" }]}>
                  TOTAL SALES
                </Text>
                <Text style={[styles.totalValue, { color: "#1D4ED8" }]}>
                  {formatCurrency(totalSales)}
                </Text>
              </View>
            </View>

            {/* ── EXPENSES ── */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: "#FFEDD5" }]}>
                <Icon source="receipt-text-outline" size={16} color="#C2410C" />
                <Text style={[styles.cardHeaderText, { color: "#C2410C" }]}>
                  EXPENSES
                </Text>
              </View>

              {(data?.expenses.length ?? 0) === 0 ? (
                <View className="flex-row items-center justify-center gap-2 py-8">
                  <Icon
                    source="receipt-text-outline"
                    size={22}
                    color="#d1d5db"
                  />
                  <Text className="text-gray-400 text-sm">
                    No expenses recorded
                  </Text>
                </View>
              ) : (
                data!.expenses.map((row: DailyExpenseRow, idx) => {
                  const primary =
                    [row.payeeName, row.sourceTypeDescription]
                      .filter(Boolean)
                      .join(" — ") || "—";
                  return (
                    <View className="py-1" key={row.id}>
                      <View className="flex-row items-start justify-between px-4 py-1 gap-3">
                        <View className="flex-1">
                          <Text
                            className="text-gray-800 font-medium text-sm"
                            numberOfLines={2}
                          >
                            {primary}
                          </Text>
                          {!!row.remarks && (
                            <Text
                              className="text-gray-400 text-xs mt-0.5"
                              numberOfLines={2}
                            >
                              {row.remarks}
                            </Text>
                          )}
                        </View>
                        <Text className="text-gray-800 font-semibold text-sm mt-0.5">
                          {formatCurrency(row.amount)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              <View style={[styles.totalRow, { backgroundColor: "#FFEDD5" }]}>
                <Text style={[styles.totalLabel, { color: "#C2410C" }]}>
                  TOTAL EXPENSES
                </Text>
                <Text style={[styles.totalValue, { color: "#C2410C" }]}>
                  {formatCurrency(totalExpenses)}
                </Text>
              </View>
            </View>

            {/* ── NET BALANCE ── */}
            <View
              style={[
                styles.netCard,
                {
                  backgroundColor: "#DCFCE7",
                  borderColor: "#86EFAC",
                },
              ]}
            >
              <View className="flex-row items-center gap-2">
                <Icon
                  source={isPositive ? "trending-up" : "trending-down"}
                  size={20}
                  color="#16A34A"
                />
                <Text style={[styles.netLabel, { color: "#15803D" }]}>
                  NET BALANCE
                </Text>
              </View>
              <Text style={[styles.netValue, { color: "#15803D" }]}>
                {formatCurrency(net)}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* ── TAGS BAR ── */}
        <TagBar
          tagType="daily-summary"
          reference={dateStr}
          defaultTagName="Remitted"
        />
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
