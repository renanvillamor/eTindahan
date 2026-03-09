import useSafePush from "@/lib/useSafePush";
import { formatCurrency } from "@/lib/utils";
import { DeliveryGroupItem } from "@/models/DeliveryGroupItem";
import { useGetDeliveries } from "@/services/useGetDeliveries";
import { format, isValid, parseISO } from "date-fns";
import { router, Stack } from "expo-router";
import { groupBy, orderBy } from "lodash";
import { useMemo } from "react";
import { RefreshControl, SectionList, Text, View } from "react-native";
import { Button, IconButton, List } from "react-native-paper";
import { useStore } from "../../../store/useStore";

type DeliverySection = {
  key: string;
  title: string;
  data: DeliveryGroupItem[];
};

export default function DeliveryScreen() {
  const deliveries = useStore((s) => s.deliveries);
  const { refetch, isFetching } = useGetDeliveries();

  const sections = useMemo<DeliverySection[]>(() => {
    const list = deliveries ?? [];

    const toDate = (ts?: string | null) => {
      if (!ts) return null;
      const iso = String(ts)
        .replace(" ", "T")
        .replace(/\+(\d{2})$/, "+$1:00");
      const dt = parseISO(iso);
      return isValid(dt) ? dt : null;
    };

    const dayKey = (ts?: string | null) => {
      const dt = toDate(ts);
      return dt ? format(dt, "yyyy-MM-dd") : ts ? String(ts).slice(0, 10) : "";
    };

    const byDate = groupBy(list, (d) => dayKey(d.transactionDate));
    const dateKeys = orderBy(Object.keys(byDate), [(k) => k], ["desc"]);

    return dateKeys.map((dateKey) => {
      const rows = byDate[dateKey] ?? [];

      const byDatetimeSupplier = groupBy(rows, (d) => {
        const dt = toDate(d.transactionDate);
        const datetimeKey = dt
          ? format(dt, "yyyy-MM-dd'T'HH:mm:ss")
          : String(d.transactionDate ?? "");
        const supplierKey = String(d.supplierId ?? d.supplierName ?? "unknown");
        return `${datetimeKey}|${supplierKey}`;
      });

      const groups: DeliveryGroupItem[] = Object.keys(byDatetimeSupplier).map(
        (groupKey) => {
          const items = byDatetimeSupplier[groupKey] ?? [];
          const supplierName = items[0]?.supplierName ?? "";
          const supplierId = items[0]?.supplierId ?? null;

          return {
            key: `${dateKey}|${groupKey}`,
            supplierId,
            supplierName,
            total: items.reduce((sum, d) => sum + Number(d.total ?? 0), 0),
            status: "PAID",
            items: items.map((d) => ({
              id: d.id,
              itemName: d.itemName ?? "",
              quantity: Number(d.quantity ?? 0),
              unitName: d.uom ?? "",
              price: Number(d.price ?? 0),
              total: Number(d.total ?? 0),
            })),
          };
        },
      );

      const data = orderBy(
        groups,
        [(g) => g.supplierName?.toLowerCase?.() ?? ""],
        ["asc"],
      );

      return {
        key: dateKey,
        title: (() => {
          try {
            const dt = parseISO(dateKey);
            return isValid(dt) ? format(dt, "MMM d, yyyy") : String(dateKey);
          } catch {
            return String(dateKey);
          }
        })(),
        data,
      };
    });
  }, [deliveries]);

  const safePush = useSafePush();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Deliveries Today",
          headerTitleAlign: "center",
          animation: "slide_from_right",
          headerLeft: () => (
            <View className="w-12 h-12 items-center justify-center -ml-2">
              <IconButton
                icon="arrow-left"
                size={24}
                onPress={() => router.back()}
                accessibilityLabel="Close"
                className="m-0"
              />
            </View>
          ),
        }}
      />

      <View className="flex-1 bg-white p-4">
        {deliveries && deliveries.length > 0 ? (
          <SectionList
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={(item) => item.key}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={refetch} />
            }
            renderSectionHeader={({ section }) => (
              <Text className="text-lg text-base font-semibold text-gray-600 mt-4 mb-1 bg-gray-100 p-2">
                {section.title}
              </Text>
            )}
            ItemSeparatorComponent={() => <View className="h-px bg-gray-200" />}
            renderItem={({ item }) => {
              return (
                <List.Accordion
                  title={item.supplierName}
                  right={(props) => (
                    <View className="flex-row justify-center items-end mr-2">
                      <Text className="font-semibold" numberOfLines={1}>
                        {formatCurrency(item.total)}
                      </Text>
                      <Text
                        className="text-sm text-gray-500 w-10 text-right ml-2"
                        numberOfLines={1}
                      >
                        {item.status}
                      </Text>
                    </View>
                  )}
                  id={item.key}
                >
                  <View className="pt-2 pl-4 pr-6 pb-3 bg-gray-50">
                    {item.items.map((line) => (
                      <View
                        key={line.id}
                        className="flex-row items-center py-1"
                      >
                        <Text
                          className="text-sm text-gray-700 flex-1 pr-3"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {line.itemName}
                        </Text>

                        <Text
                          className="text-sm text-gray-700 w-16"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {`${line.quantity} ${
                            line.unitName ? line.unitName + "/s" : ""
                          }`}
                        </Text>

                        <Text
                          className="text-sm text-gray-700 w-20 text-right"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {formatCurrency(line.price)}
                        </Text>

                        <Text
                          className="text-sm text-gray-700 w-20 text-right"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {formatCurrency(line.total)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </List.Accordion>
              );
            }}
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500">No deliveries today</Text>
          </View>
        )}
      </View>

      <View className="absolute bottom-12 left-0 right-0 px-4">
        <Button
          mode="contained"
          onPress={() => safePush("/components/inventory/add-delivery")}
        >
          Add Delivery
        </Button>
      </View>
    </>
  );
}
