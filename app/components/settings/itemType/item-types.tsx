import { CARD_COLORS } from "@/constants/Constants";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { ItemType } from "@/models/ItemType";
import { useDeleteItemType } from "@/services/useDeleteItemType";
import { useSaveItemType } from "@/services/useSaveItemType";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { FAB, IconButton, Searchbar } from "react-native-paper";
import { useStore } from "../../../../store/useStore";
import ConfirmDialog from "../../shared/ConfirmDialog";
import ItemTypeDetailsBottomSheet from "./ItemTypeDetailsBottomSheet";

export default function ItemTypesScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const { showSnackbar } = useSnackbar();

  const itemTypes = useStore((s) => s.itemTypes) ?? [];
  const updateItemType = useStore((s) => s.updateItemType);
  const removeItemType = useStore((s) => s.removeItemType);

  const [editingItem, setEditingItem] = useState<ItemType | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [query, setQuery] = useState("");

  const saveMutation = useSaveItemType();
  const deleteMutation = useDeleteItemType();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return itemTypes;
    return itemTypes.filter((t) => t.description.toLowerCase().includes(q));
  }, [itemTypes, query]);

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({ id: 0, description: "" });
  };

  const handleEdit = (item: ItemType) => {
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  const handleSave = (description: string) => {
    const payload: ItemType = { id: editingItem?.id ?? 0, description };
    saveMutation.mutate(payload, {
      onSuccess: (saved) => {
        updateItemType(saved);
        showSnackbar(
          isAddMode
            ? "Item type added successfully."
            : "Item type updated successfully.",
          "success",
        );
        setEditingItem(null);
        setIsAddMode(false);
      },
      onError: (error) => {
        showSnackbar(error.message, "error");
      },
    });
  };

  const confirmDelete = () => {
    if (deletingId === null) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => {
        removeItemType(deletingId);
        setDeletingId(null);
        showSnackbar("Item type deleted successfully.", "success");
      },
      onError: (error) => {
        showSnackbar(error.message, "error");
        setDeletingId(null);
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Item Types",
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

      <View className="flex-1 bg-gray-50">
        <View className="px-4 pt-4 pb-2">
          <Searchbar
            placeholder="Search item types"
            value={query}
            onChangeText={setQuery}
            style={styles.searchbar}
          />
        </View>

        {filtered.length > 0 ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const initials = item.description.substring(0, 2).toUpperCase();
              const avatarBg = CARD_COLORS[index % CARD_COLORS.length];
              return (
                <View style={styles.card}>
                  <View className="flex-row items-center px-4 py-3">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: avatarBg }}
                    >
                      <Text className="text-white font-bold text-sm">
                        {initials}
                      </Text>
                    </View>
                    <Text className="flex-1 text-gray-800 font-semibold text-base">
                      {item.description}
                    </Text>
                    <IconButton
                      icon="pencil-outline"
                      size={20}
                      onPress={() => handleEdit(item)}
                      style={styles.iconButton}
                    />
                    <IconButton
                      icon="trash-can-outline"
                      size={20}
                      onPress={() => setDeletingId(item.id)}
                      style={styles.iconButton}
                    />
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-400 text-base">No item types</Text>
          </View>
        )}

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      <ItemTypeDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />

      <ConfirmDialog
        visible={deletingId !== null}
        title="Delete Item Type"
        message="Are you sure you want to delete this item type?"
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onDismiss={() => setDeletingId(null)}
      />
    </>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    searchbar: {
      borderRadius: 12,
      elevation: 0,
      backgroundColor: colors.secondary,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 96,
    },
    card: {
      backgroundColor: "white",
      borderRadius: 16,
      marginBottom: 8,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    },
    iconButton: {
      margin: 0,
    },
    fab: {
      position: "absolute",
      right: 16,
      bottom: 32,
      backgroundColor: "#53B175",
      borderRadius: 28,
    },
  });
