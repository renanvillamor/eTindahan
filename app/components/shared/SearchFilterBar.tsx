import { useAppTheme } from "@/hooks/useAppTheme";
import { useStore } from "@/store/useStore";
import { ReactNode, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, Icon, Searchbar } from "react-native-paper";
import SortModal from "./SortModal";

export type SortDir = "asc" | "desc";

export type SortOption = {
  key: string;
  label: string;
};

const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "price", label: "Price" },
  { key: "quantity", label: "Quantity" },
];

type Props = {
  placeholder?: string;
  sortOptions?: SortOption[];
  children: (
    query: string,
    selectedTypeId: number | null,
    sortKey: string | null,
    sortDir: SortDir,
  ) => ReactNode;
};

export default function SearchFilterBar({
  placeholder = "Search",
  sortOptions = DEFAULT_SORT_OPTIONS,
  children,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const itemTypes = useStore((s) => s.itemTypes) ?? [];

  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortModalOpen, setSortModalOpen] = useState(false);

  const handleSortSelect = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setSortModalOpen(false);
  };

  const activeSortLabel = sortOptions.find((o) => o.key === sortKey)?.label;

  return (
    <View className="flex-1">
      <View className="px-4">
        <Searchbar
          placeholder={placeholder}
          value={query}
          onChangeText={setQuery}
          style={styles.searchbar}
        />

        <View className="flex-row items-center mb-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
            style={styles.chipsScroll}
          >
            {itemTypes.map((t) => (
              <Chip
                key={t.id}
                mode="outlined"
                selected={selectedType === t.id}
                showSelectedCheck={false}
                onPress={() =>
                  setSelectedType(selectedType === t.id ? null : t.id)
                }
                style={[
                  styles.chip,
                  selectedType === t.id && styles.selectedChip,
                ]}
                textStyle={
                  selectedType === t.id ? styles.selectedText : undefined
                }
              >
                {t.description}
              </Chip>
            ))}
          </ScrollView>

          <View>
            <Chip
              icon={({ size }) => (
                <Icon
                  source={
                    sortKey
                      ? sortDir === "asc"
                        ? "sort-ascending"
                        : "sort-descending"
                      : "sort"
                  }
                  size={size}
                  color={sortKey ? "white" : colors.onSurfaceVariant}
                />
              )}
              mode="outlined"
              selected={!!sortKey}
              showSelectedCheck={false}
              onPress={() => setSortModalOpen(true)}
              style={[styles.chip, sortKey ? styles.selectedChip : undefined]}
              textStyle={sortKey ? styles.selectedText : undefined}
            >
              {activeSortLabel ?? "Sort"}
            </Chip>
          </View>
        </View>
      </View>

      <SortModal
        visible={sortModalOpen}
        sortOptions={sortOptions}
        sortKey={sortKey}
        sortDir={sortDir}
        onSelect={handleSortSelect}
        onDismiss={() => setSortModalOpen(false)}
      />

      <View style={{ flex: 1 }}>
        {children(query, selectedType, sortKey, sortDir)}
      </View>
    </View>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    searchbar: {
      marginBottom: 8,
      backgroundColor: colors.secondary,
    },
    chipsContent: {
      alignItems: "center" as const,
    },
    chipsScroll: {
      flex: 1,
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
  });
