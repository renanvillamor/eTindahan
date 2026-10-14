import {
  checkForAppUpdate,
  getCurrentAppVersion,
  UpdateCheckResult,
} from "@/lib/appUpdate";
import { useSnackbar } from "@/lib/SnackbarContext";
import useSafePush from "@/lib/useSafePush";
import { syncPendingDeletions } from "@/services/useDeleteSale";
import { InvalidUnsyncedSalesError, useSaveSale } from "@/services/useSaveSale";
import { useStore } from "@/store/useStore";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Linking,
  Text as RNText,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Icon,
  Portal,
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

type InvalidSalesCleanupState = {
  saleIds: number[];
  itemNames: string[];
};

export default function SettingsScreen() {
  const safePush = useSafePush();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const { showSnackbar } = useSnackbar();
  const { mutateAsync: saveSales } = useSaveSale();
  const [isSyncing, setIsSyncing] = useState(false);
  const [invalidCleanupState, setInvalidCleanupState] =
    useState<InvalidSalesCleanupState | null>(null);
  const salesToday = useStore((s) => s.salesToday);
  const clearUnsyncedSales = useStore((s) => s.clearUnsyncedSales);
  const clearDeletedSales = useStore((s) => s.clearDeletedSales);
  const removeSalesByIds = useStore((s) => s.removeSalesByIds);

  const unsyncedSales = useMemo(
    () => salesToday.filter((s) => s.synced === false),
    [salesToday],
  );

  const pendingDeleteSales = useMemo(
    () => salesToday.filter((s) => s.pendingDelete === true && s.id > 0),
    [salesToday],
  );

  const handleInvalidSalesCleanup = () => {
    if (!invalidCleanupState) return;

    removeSalesByIds(invalidCleanupState.saleIds);
    showSnackbar(
      `Removed ${invalidCleanupState.saleIds.length} invalid local sale${
        invalidCleanupState.saleIds.length === 1 ? "" : "s"
      }. Sync again to continue.`,
      "success",
    );
    setInvalidCleanupState(null);
  };

  const handleSync = async () => {
    if (unsyncedSales.length === 0 && pendingDeleteSales.length === 0) {
      showSnackbar("No unsynced data to sync.", "info");
      return;
    }
    setIsSyncing(true);
    try {
      if (unsyncedSales.length > 0) {
        await saveSales(unsyncedSales);
        clearUnsyncedSales();
      }
      if (pendingDeleteSales.length > 0) {
        await syncPendingDeletions(pendingDeleteSales.map((s) => s.id));
        clearDeletedSales();
      }
      queryClient.invalidateQueries({
        queryKey: ["salesToday"],
        exact: false,
      });
      showSnackbar("Data synced successfully!", "success");
    } catch (e: any) {
      if (e instanceof InvalidUnsyncedSalesError) {
        setInvalidCleanupState({
          saleIds: e.invalidSaleIds,
          itemNames: e.invalidItemNames,
        });
      }
      showSnackbar(e?.message ?? "An error occurred", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["itemTypes"] });
    queryClient.invalidateQueries({ queryKey: ["uoms"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    queryClient.invalidateQueries({ queryKey: ["inventories"] });
    queryClient.invalidateQueries({ queryKey: ["paymentModes"] });
    queryClient.invalidateQueries({ queryKey: ["expenseCategories"] });
    queryClient.invalidateQueries({ queryKey: ["recurringExpenses"] });
  };

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] =
    useState<UpdateCheckResult | null>(null);
  const currentAppVersion = getCurrentAppVersion();

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate();
      if (result.isUpdateAvailable) {
        setAvailableUpdate(result);
      } else {
        showSnackbar(
          `You're on the latest version (v${currentAppVersion}).`,
          "success",
        );
      }
    } catch (e: any) {
      showSnackbar(e?.message ?? "Failed to check for updates.", "error");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Opens the APK download in the browser; Android then offers to install
  // it over the current app (same signing key required).
  const handleDownloadUpdate = async () => {
    if (!availableUpdate) return;
    const url = availableUpdate.latest.apkUrl ?? availableUpdate.latest.pageUrl;
    setAvailableUpdate(null);
    try {
      await Linking.openURL(url);
    } catch {
      showSnackbar("Couldn't open the download link.", "error");
    }
  };

  return (
    <>
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
            icon="credit-card-outline"
            label="Mode of Payment"
            subtitle="Manage payment methods"
            accentColor="#009688"
            onPress={() =>
              safePush("/components/settings/payment-mode/payment-modes")
            }
          />
          <SettingsTile
            icon="clipboard-text-outline"
            label="Expense Categories"
            subtitle="Categorize cash-outs & opex"
            accentColor="#795548"
            onPress={() =>
              safePush(
                "/components/settings/expense-category/expense-categories",
              )
            }
          />
        </View>

        <View className="flex-row gap-3">
          <SettingsTile
            icon="calendar-refresh-outline"
            label="Recurring Expenses"
            subtitle="Rent, salaries & other periodic opex"
            accentColor="#8D6E63"
            onPress={() =>
              safePush(
                "/components/settings/recurring-expense/recurring-expenses",
              )
            }
          />
          <View className="flex-1" />
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
              unsyncedSales.length + pendingDeleteSales.length > 0
                ? `${unsyncedSales.length + pendingDeleteSales.length} pending`
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

        <View className="flex-row gap-3">
          <SettingsTile
            icon="cellphone-arrow-down"
            label="Update Version"
            subtitle={`v${currentAppVersion} · Check for the latest release`}
            accentColor="#009688"
            onPress={handleCheckUpdate}
            loading={isCheckingUpdate}
            disabled={isCheckingUpdate}
          />
          <View className="flex-1" />
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={invalidCleanupState !== null}
          onDismiss={() => setInvalidCleanupState(null)}
        >
          <Dialog.Title>Remove Invalid Local Sales</Dialog.Title>
          <Dialog.Content>
            <RNText className="text-sm text-gray-700 leading-5">
              These local sales cannot be synced because their items no longer
              exist: {invalidCleanupState?.itemNames.join(", ") || ""}.
            </RNText>
            <RNText className="text-sm text-gray-700 leading-5 mt-3">
              Remove only these invalid local sales and keep your other pending
              sales untouched.
            </RNText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInvalidCleanupState(null)}>Cancel</Button>
            <Button onPress={handleInvalidSalesCleanup}>Remove</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={availableUpdate !== null}
          onDismiss={() => setAvailableUpdate(null)}
        >
          <Dialog.Title>Update Available</Dialog.Title>
          <Dialog.Content>
            <RNText className="text-sm text-gray-700 leading-5">
              Version v{availableUpdate?.latest.version} is available. You have
              v{availableUpdate?.currentVersion}.
            </RNText>
            {availableUpdate?.latest.notes ? (
              <ScrollView className="max-h-60 mt-3">
                <RNText className="text-xs text-gray-500 leading-5">
                  {availableUpdate.latest.notes}
                </RNText>
              </ScrollView>
            ) : null}
            <RNText className="text-xs text-gray-400 leading-4 mt-3">
              Sync any offline sales before installing.
            </RNText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAvailableUpdate(null)}>Later</Button>
            <Button onPress={handleDownloadUpdate}>Download</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

// Only kept for TouchableRipple which doesn't support className
const tileStyles = StyleSheet.create({
  ripple: {
    borderRadius: 16,
  },
});
