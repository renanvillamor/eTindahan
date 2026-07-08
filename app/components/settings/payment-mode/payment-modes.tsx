import { CARD_COLORS } from "@/constants/Constants";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSnackbar } from "@/lib/SnackbarContext";
import { PaymentMode } from "@/models/PaymentMode";
import { useDeletePaymentMode } from "@/services/useDeletePaymentMode";
import { useSavePaymentMode } from "@/services/useSavePaymentMode";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { FAB, IconButton, Searchbar } from "react-native-paper";
import { useStore } from "../../../../store/useStore";
import ConfirmDialog from "../../shared/ConfirmDialog";
import PaymentModeDetailsBottomSheet from "./PaymentModeDetailsBottomSheet";

export default function PaymentModesScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const { showSnackbar } = useSnackbar();

  const paymentModes = useStore((s) => s.paymentModes) ?? [];
  const updatePaymentMode = useStore((s) => s.updatePaymentMode);
  const removePaymentMode = useStore((s) => s.removePaymentMode);

  const [editingItem, setEditingItem] = useState<PaymentMode | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [query, setQuery] = useState("");

  const saveMutation = useSavePaymentMode();
  const deleteMutation = useDeletePaymentMode();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q
      ? paymentModes.filter((m) => m.mode.toLowerCase().includes(q))
      : paymentModes;
    return [...source].sort((a, b) => a.mode.localeCompare(b.mode));
  }, [paymentModes, query]);

  const handleAdd = () => {
    setIsAddMode(true);
    setEditingItem({ id: 0, mode: "", description: null, isDefault: false });
  };

  const handleEdit = (item: PaymentMode) => {
    setIsAddMode(false);
    setEditingItem(item);
  };

  const handleDismiss = () => {
    setEditingItem(null);
    setIsAddMode(false);
  };

  const handleSave = (
    mode: string,
    description: string,
    isDefault: boolean,
  ) => {
    const payload: PaymentMode = {
      id: editingItem?.id ?? 0,
      mode,
      description: description || null,
      isDefault,
    };
    saveMutation.mutate(payload, {
      onSuccess: (saved) => {
        // If new item was set as default, clear default flag from others in store
        if (saved.isDefault) {
          paymentModes.forEach((m) => {
            if (m.id !== saved.id && m.isDefault) {
              updatePaymentMode({ ...m, isDefault: false });
            }
          });
        }
        updatePaymentMode(saved);
        showSnackbar(
          isAddMode
            ? "Payment mode added successfully."
            : "Payment mode updated successfully.",
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
        removePaymentMode(deletingId);
        setDeletingId(null);
        showSnackbar("Payment mode deleted successfully.", "success");
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
          title: "Mode of Payment",
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
            placeholder="Search payment modes"
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
              const initials = item.mode.substring(0, 2).toUpperCase();
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
                        {item.mode}
                      </Text>
                      {item.isDefault && (
                        <Text className="text-xs text-green-600 font-medium">
                          Default
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
            <Text className="text-gray-400 text-base">No payment modes</Text>
          </View>
        )}

        <FAB icon="plus" onPress={handleAdd} style={styles.fab} color="white" />
      </View>

      <PaymentModeDetailsBottomSheet
        open={editingItem !== null}
        item={editingItem}
        isAddMode={isAddMode}
        isLoading={saveMutation.isPending}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />

      <ConfirmDialog
        visible={deletingId !== null}
        title="Delete Payment Mode"
        message="Are you sure you want to delete this payment mode?"
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
