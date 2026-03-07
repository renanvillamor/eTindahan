import CheckoutBottomSheet from "@/app/components/cart/CheckoutBottomSheet";
import FractionPickerSheet from "@/app/components/shared/FractionPickerSheet";
import SearchFilterBar from "@/app/components/shared/SearchFilterBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { formatCurrency } from "@/lib/utils";
import { Item } from "@/models/Item";
import { SaleToday } from "@/models/SaleToday";
import { useStore } from "@/store/useStore";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Text as RNText,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, IconButton, List } from "react-native-paper";

export default function CartScreen() {
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const items = useStore((s) => s.items);
  const addSalesToday = useStore((s) => s.addSalesToday);
  const [qtyByItemId, setQtyByItemId] = useState<Record<number, number>>({});

  const activeItems = useMemo(() => items.filter((it) => it.isActive), [items]);

  const cartTotal = useMemo(
    () =>
      Object.entries(qtyByItemId).reduce((sum, [id, qty]) => {
        const item = items.find((it) => it.id === Number(id));
        return sum + (item ? item.retailPrice * qty : 0);
      }, 0),
    [qtyByItemId, items],
  );

  const cartCount = useMemo(
    () => Object.values(qtyByItemId).filter((q) => q > 0).length,
    [qtyByItemId],
  );

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [fractionItemId, setFractionItemId] = useState<number | null>(null);

  const handlePay = useCallback(() => {
    const now = new Date().toISOString();
    const newSales: SaleToday[] = items
      .filter((it) => (qtyByItemId[it.id] ?? 0) > 0)
      .map((it, i) => {
        const qty = qtyByItemId[it.id];
        return {
          id: -(Date.now() + i),
          transactionDate: now,
          itemId: it.id,
          name: it.name,
          typeId: it.typeId ?? null,
          type: it.type ?? null,
          quantity: qty,
          uomId: it.singleUomId,
          uom: it.singleUom,
          price: it.retailPrice,
          total: it.retailPrice * qty,
          createdBy: null,
          synced: false,
        };
      });
    addSalesToday(newSales);
    setQtyByItemId({});
    setCheckoutOpen(false);
    showSnackbar("Payment recorded successfully!", "success");
  }, [items, qtyByItemId, addSalesToday, showSnackbar]);

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

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      const qty = qtyByItemId[item.id] ?? 0;
      return (
        <List.Item
          title={item.name}
          titleNumberOfLines={1}
          description={() => (
            <RNText className="text-sm text-gray-500">
              {formatCurrency(item.retailPrice)} / {item.singleUom ?? ""}
            </RNText>
          )}
          descriptionNumberOfLines={1}
          style={styles.listItem}
          right={() => (
            <View style={styles.qtyRow}>
              {/* Grouped stepper */}
              <View style={[styles.stepper, { borderColor: colors.outline }]}>
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

              {/* Fraction picker button */}
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
    [qtyByItemId, setQty, handleTextChange, setFractionItemId, colors],
  );

  return (
    <View className="flex-1 bg-white pt-16">
      <View className="px-4 pb-2 items-center">
        <RNText className="text-2xl font-bold text-gray-800">My Cart</RNText>
      </View>
      <SearchFilterBar placeholder="Search items">
        {(query, selectedType, sortKey, sortDir) => {
          let filtered = activeItems.filter((it) => {
            const q = query.trim().toLowerCase();
            return (
              (!q || (it.name ?? "").toLowerCase().includes(q)) &&
              (!selectedType || it.typeId === selectedType)
            );
          });
          if (sortKey) {
            filtered = [...filtered].sort((a, b) => {
              const dir = sortDir === "asc" ? 1 : -1;
              switch (sortKey) {
                case "name":
                  return dir * a.name.localeCompare(b.name);
                case "type":
                  return dir * (a.type ?? "").localeCompare(b.type ?? "");
                case "price":
                  return dir * (a.retailPrice - b.retailPrice);
                case "quantity":
                  return (
                    dir * ((qtyByItemId[a.id] ?? 0) - (qtyByItemId[b.id] ?? 0))
                  );
                default:
                  return 0;
              }
            });
          }
          return (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => (
                <View className="h-px bg-gray-200" />
              )}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View className="items-center justify-center py-16">
                  <RNText className="text-gray-400">No items found</RNText>
                </View>
              }
              renderItem={renderItem}
            />
          );
        }}
      </SearchFilterBar>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.surfaceDisabled }]}>
        <View className="flex-1">
          <RNText className="text-xs text-gray-500">
            {cartCount} item{cartCount !== 1 ? "s" : ""}
          </RNText>
          <RNText className="text-xl font-bold text-gray-800">
            {formatCurrency(cartTotal)}
          </RNText>
        </View>
        <Button
          mode="contained"
          disabled={cartCount === 0}
          onPress={() => setCheckoutOpen(true)}
          contentStyle={styles.checkoutContent}
        >
          Checkout
        </Button>
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

      <CheckoutBottomSheet
        open={checkoutOpen}
        items={items}
        qtyByItemId={qtyByItemId}
        onPay={handlePay}
        onDismiss={() => setCheckoutOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 4,
    paddingLeft: 16,
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  checkoutContent: {
    paddingHorizontal: 12,
    height: 44,
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
