import FractionPickerSheet from "@/app/components/shared/FractionPickerSheet";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { formatCurrency } from "@/lib/utils";
import { Stack, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Chip, IconButton, List, Searchbar } from "react-native-paper";
import { useSaveDelivery } from "../../../services/useSaveDelivery";
import { useStore } from "../../../store/useStore";
import DeliverySummaryBottomSheet from "./DeliverySummaryBottomSheet";

export default function AddDeliveryScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const { showSnackbar } = useSnackbar();
  const items = useStore((s) => s.items);
  const suppliers = useStore((s) => (s as any).suppliers ?? []);
  const supplierItems = useStore((s) => s.supplierItems);
  const saveDeliveryMutation = useSaveDelivery();

  const [qtyByItemId, setQtyByItemId] = useState<Record<number, number>>({});
  const [query, setQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [fractionItemId, setFractionItemId] = useState<number | null>(null);

  const selectedItems = useMemo(() => {
    return items.filter((it) => (qtyByItemId[it.id] ?? 0) > 0);
  }, [items, qtyByItemId]);

  const handleSummarySave = useCallback(() => {
    const deliveryItems = selectedItems.map((item) => ({
      item_id: item.id,
      supplier_id: selectedSupplier,
      quantity: qtyByItemId[item.id] ?? 0,
      uom_id: item.packUomId,
      price: item.supplierPrice,
      total: (qtyByItemId[item.id] ?? 0) * (item.supplierPrice ?? 0),
    }));

    saveDeliveryMutation.mutate(
      { items: deliveryItems },
      {
        onSuccess: () => {
          setSummaryOpen(false);
          setQtyByItemId({});
          showSnackbar("Delivery saved successfully!", "success");
          router.back();
        },
        onError: (error) => {
          showSnackbar(error.message, "error");
        },
      },
    );
  }, [selectedItems, selectedSupplier, qtyByItemId, saveDeliveryMutation]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    let results = items;
    if (q) {
      results = results.filter((it) =>
        (it.name ?? "").toLowerCase().includes(q),
      );
    }
    if (selectedSupplier) {
      const allowedItemIds = new Set(supplierItems[selectedSupplier] ?? []);
      results = results.filter((it) => allowedItemIds.has(it.id));
    }
    return results;
  }, [items, query, selectedSupplier, supplierItems]);

  const selectedSupplierName = useMemo(() => {
    if (!selectedSupplier) return null;
    return (
      suppliers.find((s: any) => Number(s.id) === selectedSupplier)?.name ??
      null
    );
  }, [selectedSupplier, suppliers]);

  const getQty = useCallback(
    (itemId: number) => {
      return qtyByItemId[itemId] ?? 0;
    },
    [qtyByItemId],
  );

  const setQty = useCallback((itemId: number, nextQty: number) => {
    setQtyByItemId((prev) => ({
      ...prev,
      [itemId]: Math.max(0, Number.isFinite(nextQty) ? nextQty : 0),
    }));
  }, []);

  const handleTextChange = useCallback(
    (itemId: number, text: string) => {
      const parsed = parseFloat(text.replace(/[^0-9.]/g, ""));
      setQty(itemId, Number.isNaN(parsed) ? 0 : parsed);
    },
    [setQty],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Add Delivery",
          headerTitleAlign: "center",
          animation: "slide_from_right",
          headerLeft: () => (
            <View className="w-12 h-12 items-center justify-center -ml-2">
              <IconButton
                icon="close"
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
        <View className="mb-2 flex-row items-center">
          <View className="flex-1">
            <Searchbar
              placeholder="Search items"
              value={query}
              onChangeText={setQuery}
              style={styles.searchbar}
            />
          </View>

          <IconButton
            icon="clipboard-check-outline"
            onPress={() => setSummaryOpen(true)}
            accessibilityLabel="Open delivery summary"
            disabled={!selectedSupplier}
          />
        </View>

        <View className="flex-row my-2 flex-wrap">
          {suppliers.map((s: any) => (
            <Chip
              key={s.id}
              mode="outlined"
              selected={selectedSupplier === s.id}
              showSelectedCheck={false}
              onPress={() =>
                setSelectedSupplier(selectedSupplier === s.id ? null : s.id)
              }
              style={[
                styles.chip,
                selectedSupplier === s.id && styles.selectedChip,
              ]}
              textStyle={
                selectedSupplier === s.id ? styles.selectedText : undefined
              }
            >
              {s.name}
            </Chip>
          ))}
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={filteredItems}
          keyExtractor={(item) => item.id.toString()}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-200" />}
          renderItem={({ item }) => {
            const qty = getQty(item.id);

            return (
              <List.Item
                title={item.name}
                description={() => (
                  <Text className="text-sm text-gray-500">
                    {`${formatCurrency(Number(item.supplierPrice ?? 0))} x ${
                      item.packUom ?? ""
                    }`}
                  </Text>
                )}
                right={() => (
                  <View style={styles.qtyRow}>
                    <View
                      style={[styles.stepper, { borderColor: colors.outline }]}
                    >
                      <IconButton
                        icon="minus"
                        size={16}
                        style={styles.stepperBtn}
                        disabled={qty <= 0}
                        onPress={() => setQty(item.id, Math.ceil(qty) - 1)}
                      />
                      <TextInput
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
                      style={[
                        styles.fracButton,
                        { borderColor: colors.primary },
                      ]}
                      onPress={() => setFractionItemId(item.id)}
                    >
                      <Text
                        style={[styles.fracGlyph, { color: colors.primary }]}
                      >
                        ½
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            );
          }}
        />
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

      <DeliverySummaryBottomSheet
        open={summaryOpen}
        onSave={handleSummarySave}
        onDismiss={() => setSummaryOpen(false)}
        supplierName={selectedSupplierName}
        items={selectedItems}
        qtyByItemId={qtyByItemId}
      />
    </>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    searchbar: {
      backgroundColor: colors.secondary,
    },
    chip: {
      marginRight: 8,
      borderRadius: 16,
      borderColor: colors.surfaceDisabled,
    },
    selectedChip: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    selectedText: {
      color: "white",
    },
    qtyRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
    },
    stepper: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      height: 36,
      borderWidth: 1,
      borderRadius: 8,
      overflow: "hidden" as const,
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
      fontWeight: "600" as const,
      borderWidth: 0,
      backgroundColor: "transparent",
      padding: 0,
      includeFontPadding: false,
      textAlignVertical: "center" as const,
    },
    fracButton: {
      width: 36,
      height: 36,
      borderWidth: 1,
      borderRadius: 8,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    fracGlyph: {
      fontSize: 16,
      fontWeight: "800" as const,
    },
  });
