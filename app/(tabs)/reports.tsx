import { useSnackbar } from "@/lib/SnackbarContext";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { format } from "date-fns";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TouchableRipple } from "react-native-paper";

const TILES = [
  {
    id: "daily-inventory",
    label: "Daily Inventory",
    icon: "clipboard-list-outline",
    iconColor: "#2196F3",
    iconBg: "#E3F2FD",
    description: "Stock levels & adjustments",
  },
  {
    id: "daily-sales",
    label: "Daily Sales",
    icon: "chart-bar",
    iconColor: "#53B175",
    iconBg: "#DCFCE7",
    description: "Revenue & items sold",
  },
  {
    id: "daily-deliveries",
    label: "Daily Deliveries",
    icon: "truck-delivery-outline",
    iconColor: "#F59E0B",
    iconBg: "#FEF3C7",
    description: "Deliveries per day",
  },
  {
    id: "profit-report",
    label: "Profit Report",
    icon: "trending-up",
    iconColor: "#8B5CF6",
    iconBg: "#EDE9FE",
    description: "Margins & net profit",
  },
  {
    id: "sales-profit-report",
    label: "Sale vs Profit",
    icon: "chart-pie",
    iconColor: "#0891b2",
    iconBg: "#CFFAFE",
    description: "Daily sales & profit per type",
  },
  {
    id: "inventory-variance",
    label: "Inventory Variance",
    icon: "scale-balance",
    iconColor: "#d97706",
    iconBg: "#FEF3C7",
    description: "On hand vs actual quantity",
  },
];

export default function ReportsScreen() {
  const { showSnackbar } = useSnackbar();
  const today = format(new Date(), "MMMM d, yyyy");

  const rows = [TILES.slice(0, 2), TILES.slice(2, 4), TILES.slice(4, 6)];

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="pb-8">
      <View className="px-4 pt-16 pb-2 items-center">
        <Text className="text-2xl font-bold text-gray-800">Reports</Text>
      </View>

      <View className="px-4 mt-4 gap-3">
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} className="flex-row gap-3">
            {row.map((tile) => (
              <View key={tile.id} className="flex-1">
                <TouchableRipple
                  onPress={() => {
                    if (tile.id === "daily-inventory") {
                      router.push("/components/reports/daily-inventory");
                    } else if (tile.id === "daily-sales") {
                      router.push("/components/reports/daily-sales");
                    } else if (tile.id === "profit-report") {
                      router.push("/components/reports/profit-report" as any);
                    } else if (tile.id === "daily-deliveries") {
                      router.push(
                        "/components/reports/daily-deliveries" as any,
                      );
                    } else if (tile.id === "sales-profit-report") {
                      router.push(
                        "/components/reports/sales-profit-report" as any,
                      );
                    } else if (tile.id === "inventory-variance") {
                      router.push(
                        "/components/reports/inventory-variance" as any,
                      );
                    } else {
                      showSnackbar(`${tile.label} — coming soon!`, "info");
                    }
                  }}
                  style={tileStyles.ripple}
                  rippleColor="rgba(0,0,0,0.06)"
                  borderless
                >
                  <View className="bg-white p-4 gap-3">
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center"
                      style={{ backgroundColor: tile.iconBg }}
                    >
                      <MaterialCommunityIcons
                        name={tile.icon as any}
                        size={26}
                        color={tile.iconColor}
                      />
                    </View>
                    <View>
                      <Text className="text-gray-800 font-bold text-base">
                        {tile.label}
                      </Text>
                      <Text className="text-gray-400 text-xs mt-0.5">
                        {tile.description}
                      </Text>
                    </View>
                  </View>
                </TouchableRipple>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const tileStyles = StyleSheet.create({
  ripple: {
    borderRadius: 16,
    overflow: "hidden",
  },
});
