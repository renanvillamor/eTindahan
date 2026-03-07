import { CARD_COLORS } from "@/constants/Constants";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { Supplier } from "@/models/Supplier";
import { useDeleteSupplier } from "@/services/useDeleteSupplier";
import { useSaveSupplier } from "@/services/useSaveSupplier";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { FAB, IconButton, Searchbar } from "react-native-paper";
import { useStore } from "../../../../store/useStore";
import ConfirmDialog from "../../shared/ConfirmDialog";
import SupplierDetailsBottomSheet from "./SupplierDetailsBottomSheet";

export default function SuppliersScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const { showSnackbar } = useSnackbar();

  const suppliers = useStore((s) => s.suppliers) ?? [];
  const updateSupplier = useStore((s) => s.updateSupplier);
  const removeSupplier = useStore((s) => s.removeSupplier);

  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [query, setQuery] = useState("");

  const saveMutation = useSaveSupplier();
  const deleteMutation = useDeleteSupplier();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [suppliers, query]);

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({ id: 0, name: "", description: null, contactNo: null });
  };

  const handleEdit = (item: Supplier) => {
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  const handleSave = (supplier: Supplier) => {
    saveMutation.mutate(supplier, {
      onSuccess: (saved) => {
        updateSupplier(saved);
        showSnackbar(
          isAddMode
            ? "Supplier added successfully."
            : "Supplier updated successfully.",
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
        removeSupplier(deletingId);
        setDeletingId(null);
        showSnackbar("Supplier deleted successfully.", "success");
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
          title: "Suppliers",
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
            placeholder="Search suppliers"
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
              const initials = item.name.substring(0, 2).toUpperCase();
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
                    <View className="flex-1">
                      <Text className="text-gray-800 font-semibold text-base">
                        {item.name}
                      </Text>
                      {(item.description || item.contactNo) && (
                        <Text className="text-gray-400 text-xs mt-0.5">
                          {[item.description, item.contactNo]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      )}
                    </View>
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
            <Text className="text-gray-400 text-base">No suppliers</Text>
          </View>
        )}

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      <SupplierDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />

      <ConfirmDialog
        visible={deletingId !== null}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier?"
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
