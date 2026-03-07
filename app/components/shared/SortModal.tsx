import { useAppTheme } from "@/hooks/useAppTheme";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider, List } from "react-native-paper";
import { SortDir, SortOption } from "./SearchFilterBar";

type Props = {
  visible: boolean;
  sortOptions: SortOption[];
  sortKey: string | null;
  sortDir: SortDir;
  onSelect: (key: string) => void;
  onDismiss: () => void;
};

export default function SortModal({
  visible,
  sortOptions,
  sortKey,
  sortDir,
  onSelect,
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.onSurface }]}>
            Sort by
          </Text>
          <Divider />
          {sortOptions.map((opt) => {
            const isActive = sortKey === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => onSelect(opt.key)}
                activeOpacity={0.7}
              >
                <List.Item
                  title={opt.label}
                  titleStyle={
                    isActive
                      ? { color: colors.primary, fontWeight: "700" }
                      : { color: colors.onSurface }
                  }
                  right={
                    isActive
                      ? () => (
                          <View style={styles.activeRight}>
                            <List.Icon
                              icon={
                                sortDir === "asc"
                                  ? "sort-ascending"
                                  : "sort-descending"
                              }
                              color={colors.primary}
                            />
                          </View>
                        )
                      : undefined
                  }
                />
              </TouchableOpacity>
            );
          })}
          <Divider />
          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.7}
            style={styles.cancel}
          >
            <Text style={{ color: colors.onSurfaceVariant, fontWeight: "600" }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: 280,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  activeRight: {
    justifyContent: "center",
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 14,
  },
});
