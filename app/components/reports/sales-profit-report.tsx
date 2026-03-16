import DateRangePicker from "@/app/components/shared/DateRangePicker";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  TypeSalesReportRow,
  useGetTypeSalesReport,
} from "@/services/useGetTypeSalesReport";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Divider,
  Icon,
  IconButton,
  Text,
} from "react-native-paper";

const MAX_DAYS = 14;
const DATE_COL_W = 72;
const TYPE_SALES_W = 80;
const TYPE_PROFIT_W = 80;
const TYPE_COL_W = TYPE_SALES_W + TYPE_PROFIT_W;

function fmtShort(val: number) {
  if (Math.abs(val) >= 1000) {
    return (val / 1000).toFixed(1) + "k";
  }
  return val.toFixed(0);
}

export default function SalesProfitReport() {
  const { colors } = useAppTheme();
  const today = new Date();
  const [fromDate, setFromDate] = useState(() => subDays(today, 6));
  const [toDate, setToDate] = useState(today);

  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr = format(toDate, "yyyy-MM-dd");

  const {
    data = [],
    isLoading,
    isFetching,
    refetch,
    error,
  } = useGetTypeSalesReport(fromStr, toStr);

  // All dates in range (as strings)
  const dateCols = useMemo<string[]>(
    () =>
      eachDayOfInterval({ start: fromDate, end: toDate }).map((d) =>
        format(d, "yyyy-MM-dd"),
      ),
    [fromStr, toStr],
  );

  // All unique types, sorted alphabetically (Uncategorized last)
  const types = useMemo<{ typeId: number | null; typeName: string }[]>(() => {
    const seen = new Map<string, { typeId: number | null; typeName: string }>();
    for (const row of data) {
      const key = String(row.typeId ?? "null");
      if (!seen.has(key)) {
        seen.set(key, { typeId: row.typeId, typeName: row.typeName });
      }
    }
    return [...seen.values()].sort((a, b) => {
      if (a.typeName === "Uncategorized") return 1;
      if (b.typeName === "Uncategorized") return -1;
      return a.typeName.localeCompare(b.typeName);
    });
  }, [data]);

  // Index: date → typeKey → row
  const index = useMemo<
    Record<string, Record<string, TypeSalesReportRow>>
  >(() => {
    const map: Record<string, Record<string, TypeSalesReportRow>> = {};
    for (const row of data) {
      if (!map[row.date]) map[row.date] = {};
      map[row.date][String(row.typeId ?? "null")] = row;
    }
    return map;
  }, [data]);

  // Grand totals per type
  const grandTotals = useMemo(() => {
    const tot: Record<string, { sales: number; profit: number }> = {};
    for (const t of types) {
      const key = String(t.typeId ?? "null");
      tot[key] = { sales: 0, profit: 0 };
      for (const date of dateCols) {
        const row = index[date]?.[key];
        if (row) {
          tot[key].sales += row.totalSales;
          tot[key].profit += row.totalProfit;
        }
      }
    }
    return tot;
  }, [types, dateCols, index]);

  const totalW = DATE_COL_W + types.length * TYPE_COL_W;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Sale vs Profit",
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
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          maxDays={MAX_DAYS}
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator color={colors.primary} size="large" />
            <Text className="text-gray-400 mt-3">Loading...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center py-16 gap-2">
            <Icon source="alert-circle-outline" size={40} color="#dc2626" />
            <Text className="text-red-500 text-center px-6">
              {error.message}
            </Text>
          </View>
        ) : types.length === 0 ? (
          <View className="flex-1 items-center justify-center py-16 gap-2">
            <Icon source="chart-bar" size={40} color="#d1d5db" />
            <Text className="text-gray-400">No sales data for this period</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: totalW }}>
              {/* ── Type header row ── */}
              <View
                style={[
                  styles.headerRow,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                {/* Date cell */}
                <View style={[styles.dateCell, styles.headerCell]}></View>

                {/* Two flat cells per type: Sales + Profit */}
                {types.map((t) => (
                  <View
                    key={String(t.typeId ?? "null")}
                    style={styles.typeGroup}
                  >
                    <View style={[styles.typeColCell, styles.headerCell]}>
                      <Text
                        style={[styles.headerLabel, { color: colors.primary }]}
                        numberOfLines={2}
                      >
                        {t.typeName}
                        {"\n"}SALES
                      </Text>
                    </View>
                    <View style={[styles.typeColCell, styles.headerCell]}>
                      <Text
                        style={[styles.headerLabel, { color: colors.primary }]}
                        numberOfLines={2}
                      >
                        {t.typeName}
                        {"\n"}PROFIT
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Divider />

              {/* ── Data rows ── */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              >
                {dateCols.map((date, rowIdx) => {
                  const dayIndex = index[date] ?? {};
                  const hasData = Object.keys(dayIndex).length > 0;
                  return (
                    <View key={date}>
                      <View
                        style={[
                          styles.dataRow,
                          rowIdx % 2 === 1 && styles.altRow,
                        ]}
                      >
                        {/* Date cell */}
                        <View style={styles.dateCell}>
                          <Text style={styles.dateCellDay}>
                            {format(parseISO(date), "EEE")}
                          </Text>
                          <Text style={styles.dateCellDate}>
                            {format(parseISO(date), "MMM d")}
                          </Text>
                        </View>

                        {/* Data cells */}
                        {types.map((t) => {
                          const key = String(t.typeId ?? "null");
                          const row = dayIndex[key];
                          return (
                            <View key={key} style={styles.typeGroup}>
                              <View style={styles.typeColCell}>
                                <Text
                                  style={[
                                    styles.dataValue,
                                    !row && styles.emptyValue,
                                  ]}
                                >
                                  {row ? fmtShort(row.totalSales) : "—"}
                                </Text>
                              </View>
                              <View style={styles.typeColCell}>
                                <Text
                                  style={[
                                    styles.dataValue,
                                    !row && styles.emptyValue,
                                    row &&
                                      row.totalProfit < 0 &&
                                      styles.lossValue,
                                  ]}
                                >
                                  {row ? fmtShort(row.totalProfit) : "—"}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                      <Divider />
                    </View>
                  );
                })}

                {/* ── Grand total row ── */}
                <View
                  style={[
                    styles.dataRow,
                    styles.totalRow,
                    { borderTopColor: colors.primary },
                  ]}
                >
                  <View style={styles.dateCell}>
                    <Text
                      style={[styles.totalLabel, { color: colors.primary }]}
                    >
                      TOTAL
                    </Text>
                  </View>
                  {types.map((t) => {
                    const key = String(t.typeId ?? "null");
                    const tot = grandTotals[key] ?? { sales: 0, profit: 0 };
                    return (
                      <View key={key} style={styles.typeGroup}>
                        <View style={styles.typeColCell}>
                          <Text
                            style={[
                              styles.totalValue,
                              { color: colors.primary },
                            ]}
                          >
                            {fmtShort(tot.sales)}
                          </Text>
                        </View>
                        <View style={styles.typeColCell}>
                          <Text
                            style={[
                              styles.totalValue,
                              { color: colors.primary },
                              tot.profit < 0 && styles.lossValue,
                            ]}
                          >
                            {fmtShort(tot.profit)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    paddingVertical: 6,
  },
  headerCell: {
    justifyContent: "center",
    alignItems: "center",
  },
  dateCell: {
    width: DATE_COL_W,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  typeGroup: {
    width: TYPE_COL_W,
    flexDirection: "row",
  },
  typeColCell: {
    width: TYPE_SALES_W,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dataRow: {
    flexDirection: "row",
    paddingVertical: 10,
    backgroundColor: "#fff",
    minHeight: 52,
    alignItems: "center",
  },
  altRow: {
    backgroundColor: "#f9fafb",
  },
  dateCellDay: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
  },
  dateCellDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  dataValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
  emptyValue: {
    color: "#d1d5db",
  },
  lossValue: {
    color: "#dc2626",
  },
  totalRow: {
    borderTopWidth: 2,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
