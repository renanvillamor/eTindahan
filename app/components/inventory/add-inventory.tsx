import FractionPickerSheet from "@/app/components/shared/FractionPickerSheet";
import SearchFilterBar from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { Item } from "@/models/Item";
import { useSaveInventory } from "@/services/useSaveInventory";
import { format } from "date-fns";
import { router, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Icon, IconButton, List, Text } from "react-native-paper";
import { useStore } from "../../../store/useStore";

export default function AddInventoryScreen() {
  const { colors } = useAppTheme();
  const items = useStore((s) => s.items);
  const inventories = useStore((s) => s.inventories);
  const salesToday = useStore((s) => s.salesToday);

  const [qtyByItemId, setQtyByItemId] = useState<Record<number, number>>({});
  const [fractionItemId, setFractionItemId] = useState<number | null>(null);
  const { showSnackbar } = useSnackbar();

  const today = new Date();

  const saveInventoryMutation = useSaveInventory();

  // itemId → packSize (how many singles make one pack)
  const packSizeByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const inv of inventories) {
      map[inv.itemId] = inv.packSize && inv.packSize > 0 ? inv.packSize : 1;
    }
    return map;
  }, [inventories]);

  // Map itemId → qty on hand (same calculation as inventory screen)
  const onHandByItemId = useMemo(() => {
    const soldMap: Record<number, number> = {};
    for (const s of salesToday) {
      const packSize = packSizeByItemId[s.itemId] ?? 1;
      soldMap[s.itemId] = (soldMap[s.itemId] ?? 0) + s.quantity / packSize;
    }
    const map: Record<number, number> = {};
    for (const inv of inventories) {
      map[inv.itemId] = (inv.actualQty ?? 0) - (soldMap[inv.itemId] ?? 0);
    }
    return map;
  }, [inventories, salesToday, packSizeByItemId]);

  const dirtyEntries = useMemo(() => {
    return items.filter((it) => (qtyByItemId[it.id] ?? 0) > 0);
  }, [items, qtyByItemId]);

  const getQty = useCallback(
    (itemId: number) => qtyByItemId[itemId] ?? 0,
    [qtyByItemId],
  );

  const setQty = useCallback((itemId: number, value: number) => {
    const clamped = Math.max(0, value);
    setQtyByItemId((prev) => {
      if (clamped === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: clamped };
    });
  }, []);

  const handleTextChange = useCallback(
    (itemId: number, text: string) => {
      const parsed = parseFloat(text.replace(/[^0-9.]/g, ""));
      setQty(itemId, Number.isNaN(parsed) ? 0 : parsed);
    },
    [setQty],
  );

  const handleSave = () => {
    const entries = dirtyEntries.map((item) => ({
      item_id: item.id,
      qty_on_hand: onHandByItemId[item.id] ?? 0,
      actual_qty: qtyByItemId[item.id],
      uom_id: item.packUomId,
    }));

    saveInventoryMutation.mutate(
      { createdDate: format(today, "yyyy-MM-dd"), entries },
      {
        onSuccess: () => {
          showSnackbar("Inventory saved successfully!", "success");
          router.back();
        },
        onError: (error) => showSnackbar(error.message, "error"),
      },
    );
  };

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      const qty = getQty(item.id);
      const hasInput = item.id in qtyByItemId;
      const onHand = onHandByItemId[item.id];
      const rowBg = !hasInput
        ? undefined
        : qty === onHand
          ? colors.primaryContainer
          : colors.errorContainer;
      return (
        <List.Item
          title={item.name}
          titleNumberOfLines={1}
          style={[styles.listItem, { backgroundColor: rowBg }]}
          description={() => (
            <RNText className="text-sm text-gray-400">
              ON-HAND: &nbsp;&nbsp;&nbsp;
              {onHand !== undefined && (
                <RNText className="text-sm text-gray-400">
                  {Number.isInteger(onHand) ? `${onHand}` : onHand.toFixed(2)}
                  {item.packUom ? ` ${item.packUom}/s` : ""}
                </RNText>
              )}
            </RNText>
          )}
          right={() => (
            <View style={styles.qtyRow}>
              <View style={[styles.stepper, { borderColor: colors.outline }]}>
                <IconButton
                  icon="minus"
                  size={16}
                  style={styles.stepperBtn}
                  disabled={qty <= 0}
                  onPress={() => setQty(item.id, Math.ceil(qty) - 1)}
                />
                <RNTextInput
                  keyboardType="decimal-pad"
                  value={String(qty)}
                  onChangeText={(v) => handleTextChange(item.id, v)}
                  style={styles.qtyInput}
                  textAlign="center"
                />
                <IconButton
                  icon="plus"
                  size={16}
                  style={styles.stepperBtn}
                  onPress={() => setQty(item.id, Math.floor(qty) + 1)}
                />
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.fracButton, { borderColor: colors.primary }]}
                onPress={() => setFractionItemId(item.id)}
              >
                <RNText style={[styles.fracGlyph, { color: colors.primary }]}>
                  ½
                </RNText>
              </TouchableOpacity>
            </View>
          )}
        />
      );
    },
    [
      getQty,
      setQty,
      handleTextChange,
      onHandByItemId,
      qtyByItemId,
      colors,
      setFractionItemId,
    ],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Add Inventory",
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

      <View className="flex-1 bg-white py-8">
        {/* Date + progress bar */}
        <View className="items-center px-4 pb-3 border-b border-gray-100">
          <View className="flex-row items-center gap-2">
            <Icon source="calendar-today" size={16} color={colors.primary} />
            <View>
              <Text className="text-xs text-gray-400 uppercase">
                Inventory Date
              </Text>
              <Text className="text-sm font-semibold text-gray-800">
                {format(today, "MMMM d, yyyy")}
              </Text>
            </View>
          </View>
        </View>

        <SearchFilterBar placeholder="Search items">
          {(query, selectedType, sortKey, sortDir) => {
            let filteredItems = items
              .filter((it) => it.isActive)
              .filter((it) => {
                const q = query.trim().toLowerCase();
                return (
                  (!q || (it.name ?? "").toLowerCase().includes(q)) &&
                  (!selectedType || it.typeId === selectedType)
                );
              });
            if (sortKey) {
              filteredItems = [...filteredItems].sort((a, b) => {
                const dir = sortDir === "asc" ? 1 : -1;
                switch (sortKey) {
                  case "name":
                    return dir * a.name.localeCompare(b.name);
                  case "type":
                    return dir * (a.type ?? "").localeCompare(b.type ?? "");
                  case "quantity": {
                    const aQty = onHandByItemId[a.id] ?? 0;
                    const bQty = onHandByItemId[b.id] ?? 0;
                    return dir * (aQty - bQty);
                  }
                  default:
                    return 0;
                }
              });
            }
            return (
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id.toString()}
                ItemSeparatorComponent={() => (
                  <View className="h-px bg-gray-100" />
                )}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View className="flex-row justify-end py-2 pr-20 bg-gray-50 border-b border-gray-100">
                    <Text className="w-22 text-xs font-semibold text-gray-400 uppercase text-center">
                      Actual Count
                    </Text>
                  </View>
                }
                ListEmptyComponent={
                  <View className="items-center justify-center py-16 gap-2">
                    <Icon
                      source="package-variant-closed"
                      size={40}
                      color="#d1d5db"
                    />
                    <Text className="text-gray-400">No items found</Text>
                  </View>
                }
              />
            );
          }}
        </SearchFilterBar>

        {/* Save Button */}
        <View className="px-4 py-4 border-t border-gray-100">
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={
              dirtyEntries.length === 0 || saveInventoryMutation.isPending
            }
            loading={saveInventoryMutation.isPending}
          >
            Save Changes
          </Button>
        </View>
      </View>

      <FractionPickerSheet
        open={fractionItemId !== null}
        itemName={items.find((it) => it.id === fractionItemId)?.name}
        currentQty={
          fractionItemId !== null ? (qtyByItemId[fractionItemId] ?? 0) : 0
        }
        onSelect={(decimal) => {
          if (fractionItemId !== null) {
            const whole = Math.floor(qtyByItemId[fractionItemId] ?? 0);
            setQty(fractionItemId, whole + decimal);
          }
        }}
        onDismiss={() => setFractionItemId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 4,
    paddingLeft: 0,
    paddingRight: 4,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  stepperBtn: {
    margin: 0,
    width: 36,
    height: 36,
    borderRadius: 0,
  },
  qtyInput: {
    width: 44,
    height: 36,
    fontSize: 15,
    fontWeight: "600",
    borderWidth: 0,
    backgroundColor: "transparent",
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  fracButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fracGlyph: {
    fontSize: 16,
    fontWeight: "800",
  },
});
