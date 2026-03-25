import { useSnackbar } from "@/lib/SnackbarContext";
import { Item } from "@/models/Item";
import { useDeleteItem } from "@/services/useDeleteItem";
import { useSaveItem } from "@/services/useSaveItem";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { FAB, IconButton } from "react-native-paper";
import { useStore } from "../../../../store/useStore";
import ConfirmDialog from "../../shared/ConfirmDialog";
import SearchFilterBar from "../../shared/SearchFilterBar";
import ItemDetailsBottomSheet from "./ItemDetailsBottomSheet";
import ItemList from "./ItemList";

export default function ItemsScreen() {
  const { showSnackbar } = useSnackbar();
  const items = useStore((s) => s.items) ?? [];
  const suppliers = useStore((s) => s.suppliers) ?? [];
  const supplierItems = useStore((s) => s.supplierItems) ?? {};
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);

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
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);

  const saveMutation = useSaveItem();
  const deleteMutation = useDeleteItem();

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({
      id: 0,
      name: "",
      description: null,
      type: null,
      typeId: null,
      isActive: true,
      supplierPrice: 0,
      wholesalePrice: 0,
      retailPrice: 0,
      defaultUom: "",
      defaultUomId: 0,
      deliveryUom: "",
      deliveryUomId: 0,
      saleUom: "",
      saleUomId: 0,
    });
  };

  const handleEdit = (item: Item) => {
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDelete = (itemId: number) => {
    setDeletingItemId(itemId);
  };

  const confirmDelete = async () => {
    if (deletingItemId === null) return;

    deleteMutation.mutate(deletingItemId, {
      onSuccess: () => {
        removeItem(deletingItemId);
        setDeletingItemId(null);
        showSnackbar("Item deleted successfully.", "success");
      },
      onError: (error) => {
        console.error("Failed to delete item:", error);
        showSnackbar(error.message, "error");
        setDeletingItemId(null);
      },
    });
  };

  const handleSave = async (item: Item) => {
    saveMutation.mutate(item, {
      onSuccess: (savedItem) => {
        updateItem(savedItem);
        showSnackbar(
          isAddMode ? "Item added successfully." : "Item updated successfully.",
          "success",
        );
        setEditingItem(null);
        setIsAddMode(false);
      },
      onError: (error) => {
        console.error("Failed to save item:", error);
        showSnackbar(error.message, "error");
      },
    });
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Items",
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

      <View className="flex-1 bg-gray-50 pt-4">
        <SearchFilterBar placeholder="Search items">
          {(query, selectedType) => {
            const filtered = items.filter((it) => {
              const q = query.trim().toLowerCase();
              return (
                (!q || (it.name || "").toLowerCase().includes(q)) &&
                (!selectedType || it.typeId === selectedType)
              );
            });
            return (
              <ItemList
                items={filtered}
                suppliers={suppliers}
                supplierItems={itemSupplierMap}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            );
          }}
        </SearchFilterBar>

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      <ItemDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />

      <ConfirmDialog
        visible={deletingItemId !== null}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onDismiss={() => setDeletingItemId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 32,
    backgroundColor: "#53B175",
    borderRadius: 28,
  },
});
