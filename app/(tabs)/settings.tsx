import { useSnackbar } from "@/lib/SnackbarContext";
import useSafePush from "@/lib/useSafePush";
import { useSaveSale } from "@/services/useSaveSale";
import { useStore } from "@/store/useStore";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import * as Updates from "expo-updates";
import { useMemo, useState } from "react";
import {
  Alert,
  Text as RNText,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Card,
  Icon,
  TouchableRipple,
} from "react-native-paper";

type TileProps = {
  icon: string;
  label: string;
  subtitle: string;
  accentColor: string;
  onPress: () => void;
  badge?: string;
  badgeVariant?: "error" | "muted";
  loading?: boolean;
  disabled?: boolean;
};

function SettingsTile({
  icon,
  label,
  subtitle,
  accentColor,
  onPress,
  badge,
  badgeVariant = "muted",
  loading = false,
  disabled = false,
}: TileProps) {
  return (
    <Card className="flex-1 rounded-2xl bg-white overflow-hidden" elevation={1}>
      <TouchableRipple
        onPress={onPress}
        disabled={disabled}
        borderless
        style={tileStyles.ripple}
      >
        <View className="p-4 min-h-[130px]">
          <View
            className="w-11 h-11 rounded-xl items-center justify-center mb-3"
            style={{ backgroundColor: accentColor }}
          >
            {loading ? (
              <ActivityIndicator size={22} color="#fff" />
            ) : (
              <Icon source={icon} size={22} color="#fff" />
            )}
          </View>
          <RNText
            className="text-sm font-bold text-gray-900 mb-0.5"
            numberOfLines={1}
          >
            {label}
          </RNText>
          <RNText
            className="text-[11px] text-gray-400 leading-[15px]"
            numberOfLines={2}
          >
            {subtitle}
          </RNText>
          {badge ? (
            <View
              className={`self-start rounded-lg px-2 py-0.5 mt-2 ${
                badgeVariant === "error" ? "bg-red-50" : "bg-gray-100"
              }`}
            >
              <RNText className="text-[10px] font-bold text-red-600">
                {badge}
              </RNText>
            </View>
          ) : null}
        </View>
      </TouchableRipple>
    </Card>
  );
}

export default function SettingsScreen() {
  const safePush = useSafePush();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const { showSnackbar } = useSnackbar();
  const { mutateAsync: saveSales, isPending: isSyncing } = useSaveSale();
  const salesToday = useStore((s) => s.salesToday);
  const clearUnsyncedSales = useStore((s) => s.clearUnsyncedSales);

  const unsyncedSales = useMemo(
    () => salesToday.filter((s) => s.synced === false),
    [salesToday],
  );

  const handleSync = async () => {
    if (unsyncedSales.length === 0) {
      showSnackbar("No unsynced data to sync.", "info");
      return;
    }
    try {
      await saveSales(unsyncedSales);
      clearUnsyncedSales();
      queryClient.invalidateQueries({ queryKey: ["salesToday"] });
      showSnackbar("Data synced successfully!", "success");
    } catch (e: any) {
      showSnackbar(e?.message ?? "An error occurred", "error");
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["itemTypes"] });
    queryClient.invalidateQueries({ queryKey: ["uoms"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    queryClient.invalidateQueries({ queryKey: ["inventories"] });
  };

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const handleCheckUpdate = async () => {
    if (!Updates.isEnabled) {
      showSnackbar("Updates not available in this build.", "info");
      return;
    }
    setIsCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        Alert.alert(
          "Update Available",
          "A new version is ready. Restart now to apply it?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart Now",
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              },
            },
          ],
        );
      } else {
        showSnackbar("App is up to date.", "success");
      }
    } catch {
      showSnackbar("Failed to check for updates.", "error");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50 pt-4"
      contentContainerClassName="px-4 pt-14 pb-8 gap-3"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row gap-3">
        <SettingsTile
          icon="package-variant"
          label="Items"
          subtitle="Manage your product catalog"
          accentColor="#4CAF50"
          onPress={() => safePush("/components/settings/item/items")}
        />
        <SettingsTile
          icon="shape"
          label="Item Types"
          subtitle="Organise items by category"
          accentColor="#2196F3"
          onPress={() => safePush("/components/settings/itemType/item-types")}
        />
      </View>

      <View className="flex-row gap-3">
        <SettingsTile
          icon="truck-delivery"
          label="Suppliers"
          subtitle="Manage your suppliers"
          accentColor="#FF9800"
          onPress={() => safePush("/components/settings/supplier/suppliers")}
        />
        <SettingsTile
          icon="weight-kilogram"
          label="UOM"
          subtitle="Units of measurement"
          accentColor="#9C27B0"
          onPress={() => safePush("/components/settings/uom/uom")}
        />
      </View>

      <View className="flex-row gap-3">
        <SettingsTile
          icon="cloud-sync-outline"
          label="Sync Data"
          subtitle="Upload offline sales to server"
          accentColor="#00BCD4"
          onPress={handleSync}
          loading={isSyncing}
          disabled={isSyncing}
          badge={
            unsyncedSales.length > 0
              ? `${unsyncedSales.length} pending`
              : undefined
          }
          badgeVariant="error"
        />
        <SettingsTile
          icon="refresh"
          label="Refresh Data"
          subtitle="Re-fetch all data from server"
          accentColor="#3F51B5"
          onPress={handleRefresh}
          loading={isFetching > 0}
          disabled={isFetching > 0}
        />
      </View>

      <View className="flex-row gap-3">
        <SettingsTile
          icon="cog-outline"
          label="App Settings"
          subtitle="Preferences and configuration"
          accentColor="#607D8B"
          onPress={() => safePush("/components/settings/app-settings")}
        />
        <SettingsTile
          icon="account-circle-outline"
          label="Account"
          subtitle="Profile and authentication"
          accentColor="#E91E63"
          onPress={() => safePush("/components/settings/account")}
        />
      </View>

      {/* <View className="flex-row gap-3">
        <SettingsTile
          icon="cellphone-arrow-down"
          label="App Update"
          subtitle="Check and install latest version"
          accentColor="#009688"
          onPress={handleCheckUpdate}
          loading={isCheckingUpdate}
          disabled={isCheckingUpdate}
        />
        <View className="flex-1" />
      </View> */}
    </ScrollView>
  );
}

// Only kept for TouchableRipple which doesn't support className
const tileStyles = StyleSheet.create({
  ripple: {
    borderRadius: 16,
  },
});
