import { useAppTheme } from "@/hooks/useAppTheme";
import { formatCurrency } from "@/lib/utils";
import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { SectionList, StyleSheet, View } from "react-native";
import { Divider, IconButton, List, Text } from "react-native-paper";
import { useStore } from "../../../store/useStore";

type PayableLine = {
  id: number;
  itemName: string;
  quantity: number;
  unitName: string;
  price: number;
  total: number;
};

type PayableGroup = {
  key: string;
  supplierName: string;
  total: number;
  items: PayableLine[];
};

type PayableSection = {
  key: string;
  title: string;
  data: PayableGroup[];
};

export default function PayablesScreen() {
  const { colors } = useAppTheme();
  const deliveries = useStore((s) => s.deliveries);

  // Group unpaid deliveries by supplier as payables
  const sections = useMemo<PayableSection[]>(() => {
    if (!deliveries || deliveries.length === 0) return [];

    const bySupplier: Record<string, PayableLine[]> = {};
    const supplierNames: Record<string, string> = {};

    for (const d of deliveries) {
      const key = String(d.supplierId ?? d.supplierName ?? "Unknown");
      supplierNames[key] = d.supplierName ?? "Unknown Supplier";
      if (!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push({
        id: d.id,
        itemName: d.itemName ?? "",
        quantity: Number(d.quantity ?? 0),
        unitName: d.unitName ?? "",
        price: Number(d.price ?? 0),
        total: Number(d.total ?? 0),
      });
    }

    const groups: PayableGroup[] = Object.keys(bySupplier).map((key) => {
      const lines = bySupplier[key];
      return {
        key,
        supplierName: supplierNames[key],
        total: lines.reduce((sum, l) => sum + l.total, 0),
        items: lines,
      };
    });

    if (groups.length === 0) return [];

    const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);

    return [
      {
        key: "payables",
        title: `Total Payables: ${formatCurrency(grandTotal)}`,
        data: groups,
      },
    ];
  }, [deliveries]);

  const styles = useStyles(colors);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Payables",
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

      <View className="flex-1 bg-white">
        {sections.length > 0 ? (
          <SectionList
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={(item) => item.key}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.listContent}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View className="h-px bg-gray-200" />}
            renderItem={({ item }) => (
              <List.Accordion
                title={item.supplierName}
                right={() => (
                  <View className="flex-row justify-center items-center mr-2">
                    <Text className="font-semibold">
                      {formatCurrency(item.total)}
                    </Text>
                  </View>
                )}
                id={item.key}
              >
                <View className="pt-2 pl-4 pr-6 pb-3 bg-gray-50">
                  {/* Column headers */}
                  <View className="flex-row items-center pb-1 mb-1">
                    <Text className="text-xs text-gray-400 flex-1 pr-3">
                      Item
                    </Text>
                    <Text className="text-xs text-gray-400 w-16">Qty</Text>
                    <Text className="text-xs text-gray-400 w-20 text-right">
                      Price
                    </Text>
                    <Text className="text-xs text-gray-400 w-20 text-right">
                      Total
                    </Text>
                  </View>
                  <Divider />
                  {item.items.map((line) => (
                    <View key={line.id} className="flex-row items-center py-1">
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
                      >
                        {`${line.quantity} ${line.unitName ? line.unitName + "/s" : ""}`}
                      </Text>
                      <Text
                        className="text-sm text-gray-700 w-20 text-right"
                        numberOfLines={1}
                      >
                        {formatCurrency(line.price)}
                      </Text>
                      <Text
                        className="text-sm text-gray-700 w-20 text-right"
                        numberOfLines={1}
                      >
                        {formatCurrency(line.total)}
                      </Text>
                    </View>
                  ))}
                </View>
              </List.Accordion>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400">No payables recorded</Text>
          </View>
        )}
      </View>
    </>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: 24,
    },
    sectionHeader: {
      backgroundColor: colors.secondaryContainer ?? "#F3F4F6",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.onSecondaryContainer ?? "#374151",
    },
  });
