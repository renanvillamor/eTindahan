import { useAppTheme } from "@/hooks/useAppTheme";
import { Supplier } from "@/models/Supplier";
import { useStore } from "@/store/useStore";
import { ReactNode, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, IconButton, Searchbar } from "react-native-paper";
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
  showSupplierFilter?: boolean;
  suppliers?: Supplier[];
  children: (
    query: string,
    selectedTypeId: number | null,
    selectedSupplierId: number | null,
    sortKey: string | null,
    sortDir: SortDir,
  ) => ReactNode;
};

export default function SearchFilterBar({
  placeholder = "Search",
  sortOptions = DEFAULT_SORT_OPTIONS,
  showSupplierFilter = false,
  suppliers = [],
  children,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const rawItemTypes = useStore((s) => s.itemTypes) ?? [];

  const itemTypes = useMemo(
    () =>
      [...rawItemTypes].sort((a, b) =>
        a.description.localeCompare(b.description),
      ),
    [rawItemTypes],
  );

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers],
  );

  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
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

  return (
    <View className="flex-1">
      <View className="px-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Searchbar
            placeholder={placeholder}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchbar, { flex: 1, marginBottom: 0 }]}
          />

          <IconButton
            icon={
              sortKey
                ? sortDir === "asc"
                  ? "sort-ascending"
                  : "sort-descending"
                : "sort"
            }
            mode="outlined"
            size={20}
            iconColor={sortKey ? "white" : colors.onSurfaceVariant}
            containerColor={sortKey ? colors.primary : undefined}
            onPress={() => setSortModalOpen(true)}
            style={styles.sortButton}
            accessibilityLabel="Sort"
          />
        </View>

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
        </View>

        {showSupplierFilter && sortedSuppliers.length > 0 && (
          <View className="flex-row items-center mb-3">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}
              style={styles.chipsScroll}
            >
              {sortedSuppliers.map((s) => (
                <Chip
                  key={`supplier-${s.id}`}
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
            </ScrollView>
          </View>
        )}
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
        {children(query, selectedType, selectedSupplier, sortKey, sortDir)}
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
    sortButton: {
      margin: 0,
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
