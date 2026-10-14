import ItemQuantitySheet from "@/app/components/shared/ItemQuantitySheet";
import SearchFilterBar from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useInventoryActivity } from "@/hooks/useInventoryActivity";
import { useSnackbar } from "@/lib/SnackbarContext";
import { Item } from "@/models/Item";
import { Supplier } from "@/models/Supplier";
import { useGetDeliveries } from "@/services/useGetDeliveries";
import { useGetInventories } from "@/services/useGetInventories";
import { useGetInventoryToday } from "@/services/useGetInventoryToday";
import { useGetSalesToday } from "@/services/useGetSalesToday";
import { useSaveInventory } from "@/services/useSaveInventory";
import { format } from "date-fns";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Icon, IconButton, List, Text } from "react-native-paper";
import { useStore } from "../../../store/useStore";

function buildSupplierSections<T>(
  items: T[],
  getItemId: (item: T) => number,
  suppliers: Supplier[],
  itemSupplierMap: Record<number, number[]>,
): { title: string; supplierId: number | null; data: T[] }[] {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const grouped = new Map<number | null, T[]>();

  for (const item of items) {
    const itemId = getItemId(item);
    const supplierIds = itemSupplierMap[itemId];
    if (supplierIds && supplierIds.length > 0) {
      for (const sid of supplierIds) {
        if (!grouped.has(sid)) grouped.set(sid, []);
        grouped.get(sid)!.push(item);
      }
    } else {
      if (!grouped.has(null)) grouped.set(null, []);
      grouped.get(null)!.push(item);
    }
  }

  const sections: { title: string; supplierId: number | null; data: T[] }[] =
    [];
  for (const [sid, data] of grouped.entries()) {
    if (sid === null) continue;
    sections.push({
      title: supplierMap.get(sid) ?? `Supplier #${sid}`,
      supplierId: sid,
      data,
    });
  }
  sections.sort((a, b) => a.title.localeCompare(b.title));
  if (grouped.has(null)) {
    sections.push({
      title: "Other",
      supplierId: null,
      data: grouped.get(null)!,
    });
  }
  return sections;
}

export default function AddInventoryScreen() {
  const { colors } = useAppTheme();
  const items = useStore((s) => s.items);
  const inventories = useStore((s) => s.inventories);
  const suppliers = useStore((s) => s.suppliers);
  const supplierItems = useStore((s) => s.supplierItems);

  const [qtyByItemId, setQtyByItemId] = useState<Record<number, number>>({});
  const [quantitySheetItemId, setQuantitySheetItemId] = useState<
    number | null
  >(null);
  const { showSnackbar } = useSnackbar();

  const today = new Date();

  const saveInventoryMutation = useSaveInventory();

  // These hooks already fetch on mount and write into the store on their
  // own — no need for an extra imperative refetch on top. isLoading (not
  // isFetching) so a background revalidation of already-cached data doesn't
  // re-block the screen on every visit.
  const { isLoading: isLoadingInventories } = useGetInventories();
  const { isLoading: isLoadingSales } = useGetSalesToday();
  const { isLoading: isLoadingDeliveries } = useGetDeliveries();
  // Today's already-recorded counts (if any) — lets this screen double as
  // a correction flow: reopening it same-day prefills what was already
  // counted instead of showing blank inputs.
  const { data: todayData, isLoading: isLoadingToday } =
    useGetInventoryToday();

  const isLoading =
    isLoadingInventories ||
    isLoadingSales ||
    isLoadingDeliveries ||
    isLoadingToday;

  // Prefill qtyByItemId from today's already-saved counts exactly once per
  // screen visit, so later refetches (e.g. after Save invalidates the
  // query) never clobber values the user is actively editing.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current || !todayData) return;
    prefilledRef.current = true;
    const entries = Object.entries(todayData);
    if (entries.length === 0) return;
    setQtyByItemId((prev) => {
      const next = { ...prev };
      for (const [itemId, entry] of entries) {
        if (!(Number(itemId) in next)) next[Number(itemId)] = entry.actualQty;
      }
      return next;
    });
  }, [todayData]);

  // Build reverse map: itemId → supplierId[]
  const itemSupplierMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    for (const [supplierId, itemIds] of Object.entries(supplierItems)) {
      for (const itemId of itemIds) {
        if (!map[itemId]) map[itemId] = [];
        map[itemId].push(Number(supplierId));
      }
    }
    return map;
  }, [supplierItems]);

  // Map itemId → qty on hand (last actual count + delivered − sold since
  // that count, covering any gap days where inventory wasn't counted).
  const activityByItemId = useInventoryActivity();
  const onHandByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const item of items) {
      map[item.id] = activityByItemId[item.id]?.onHand ?? 0;
    }
    return map;
  }, [items, activityByItemId]);

  // "Dirty" means worth saving: a brand-new count for an item not yet
  // recorded today, or a value that differs from what's already recorded
  // today. Without the second check, prefilled-but-untouched items (see
  // above) would re-insert a redundant, unchanged row on every Save.
  const dirtyEntries = useMemo(() => {
    return items.filter((it) => {
      if (!(it.id in qtyByItemId)) return false;
      const recordedToday = todayData?.[it.id]?.actualQty;
      if (recordedToday === undefined) return true;
      return qtyByItemId[it.id] !== recordedToday;
    });
  }, [items, qtyByItemId, todayData]);

  const getQty = useCallback(
    (itemId: number) => qtyByItemId[itemId] ?? 0,
    [qtyByItemId],
  );

  const setQty = useCallback((itemId: number, value: number) => {
    const clamped = Math.max(0, value);
    setQtyByItemId((prev) => ({ ...prev, [itemId]: clamped }));
  }, []);

  const handleTextChange = useCallback(
    (itemId: number, text: string) => {
      const parsed = parseFloat(text.replace(/[^0-9.]/g, ""));
      setQty(itemId, Number.isNaN(parsed) ? 0 : parsed);
    },
    [setQty],
  );

  const handleSave = () => {
    // Only items the user actually entered a count for should be saved —
    // otherwise every untouched item would get a false `actual_qty: 0` row,
    // corrupting variance reports and resetting future on-hand baselines to
    // zero for items that were never physically counted today.
    const missingUom = dirtyEntries.filter((it) => it.isActive && !it.packUomId);
    if (missingUom.length > 0) {
      const names = missingUom.map((it) => it.name).join(", ");
      showSnackbar(`Items missing Pack UOM: ${names}`, "error");
      return;
    }

    const entries = dirtyEntries
      .filter((it) => it.isActive)
      .map((item) => ({
        item_id: item.id,
        qty_on_hand: onHandByItemId[item.id] ?? 0,
        actual_qty: qtyByItemId[item.id] ?? 0,
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
      const recordedToday = todayData?.[item.id];
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
            <View>
              <RNText className="text-sm text-gray-400">
                ON-HAND: &nbsp;&nbsp;&nbsp;
                {onHand !== undefined && (
                  <RNText className="text-sm text-gray-400">
                    {Number.isInteger(onHand)
                      ? `${onHand}`
                      : onHand.toFixed(2)}
                    {item.packUom ? ` ${item.packUom}/s` : ""}
                  </RNText>
                )}
              </RNText>
              {recordedToday && (
                <RNText
                  className="text-xs font-semibold"
                  style={{ color: colors.primary }}
                >
                  Counted today:{" "}
                  {Number.isInteger(recordedToday.actualQty)
                    ? recordedToday.actualQty
                    : recordedToday.actualQty.toFixed(2)}
                  {item.packUom ? ` ${item.packUom}/s` : ""}
                </RNText>
              )}
            </View>
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
                onPress={() => setQuantitySheetItemId(item.id)}
              >
                <RNText style={[styles.fracGlyph, { color: colors.primary }]}>
                  ⋯
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
      todayData,
      colors,
      setQuantitySheetItemId,
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

        <SearchFilterBar placeholder="Search items" showSupplierFilter suppliers={suppliers}>
          {(query, selectedType, selectedSupplierId, sortKey, sortDir) => {
            let filteredItems = items
              .filter((it) => it.isActive)
              .filter((it) => {
                const q = query.trim().toLowerCase();
                const matchesSupplier =
                  !selectedSupplierId ||
                  (itemSupplierMap[it.id] ?? []).includes(selectedSupplierId);
                return (
                  (!q || (it.name ?? "").toLowerCase().includes(q)) &&
                  (!selectedType || it.typeId === selectedType) &&
                  matchesSupplier
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
            // Group by supplier
            const sections = buildSupplierSections(
              filteredItems,
              (it) => it.id,
              suppliers,
              itemSupplierMap,
            );

            return (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                ItemSeparatorComponent={() => (
                  <View className="h-px bg-gray-100" />
                )}
                renderSectionHeader={({ section }) => (
                  <View className="px-4 py-1.5 bg-gray-100 border-b border-gray-200">
                    <RNText className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {section.title}
                    </RNText>
                  </View>
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
              dirtyEntries.length === 0 ||
              saveInventoryMutation.isPending ||
              isLoading
            }
            loading={saveInventoryMutation.isPending || isLoading}
          >
            Save Changes
          </Button>
        </View>
      </View>

      <ItemQuantitySheet
        open={quantitySheetItemId !== null}
        item={items.find((it) => it.id === quantitySheetItemId) ?? null}
        currentQty={
          quantitySheetItemId !== null
            ? (qtyByItemId[quantitySheetItemId] ?? 0)
            : 0
        }
        amountPrice={null}
        qtyUnitLabel={
          items.find((it) => it.id === quantitySheetItemId)?.packUom
        }
        onApply={(qty) => {
          if (quantitySheetItemId !== null) {
            setQty(quantitySheetItemId, qty);
          }
        }}
        onDismiss={() => setQuantitySheetItemId(null)}
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
