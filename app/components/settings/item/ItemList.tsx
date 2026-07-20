import { CARD_COLORS } from "@/constants/Constants";
import { Item } from "@/models/Item";
import { Supplier } from "@/models/Supplier";
import { memo } from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { IconButton } from "react-native-paper";

type Props = {
  items: Item[];
  suppliers: Supplier[];
  supplierItems: Record<number, number[]>;
  onEdit: (item: Item) => void;
  onDelete: (itemId: number) => void;
  onHistory: (item: Item) => void;
};

type CardProps = {
  item: Item;
  index: number;
  onEdit: (item: Item) => void;
  onDelete: (itemId: number) => void;
  onHistory: (item: Item) => void;
};

const ItemCard = memo(function ItemCard({
  item,
  index,
  onEdit,
  onDelete,
  onHistory,
}: CardProps) {
  const avatarBg = CARD_COLORS[index % CARD_COLORS.length];
  return (
    <View style={styles.card}>
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <View className="flex-1 pl-1">
          <Text
            className="text-gray-800 font-semibold text-base"
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </View>
        <IconButton
          icon="clock-time-four-outline"
          size={20}
          onPress={() => onHistory(item)}
          style={styles.iconButton}
        />
        <IconButton
          icon="pencil-outline"
          size={20}
          onPress={() => onEdit(item)}
          style={styles.iconButton}
        />
        <IconButton
          icon="trash-can-outline"
          size={20}
          onPress={() => onDelete(item.id)}
          style={styles.iconButton}
        />
      </View>
      <View
        className="flex-row mx-4 mb-3 rounded-xl overflow-hidden"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <View className="flex-1 items-center py-2">
          <Text className="text-xs text-gray-400 mb-0.5">
            Supplier{" "}
            <Text className="text-[10px]">
              / {item.packUom || "pack"}
            </Text>
          </Text>
          <Text className="text-sm font-semibold text-gray-700">
            ₱{item.supplierPrice.toFixed(2)}
          </Text>
          {/* Supplier price is per pack, not per unit — show the per-unit
              equivalent so it isn't misread as directly comparable to the
              per-unit Wholesale/Retail prices beside it. */}
          {item.packSize && item.packSize > 0 && (
            <Text className="text-[10px] text-gray-400">
              ≈ ₱{(item.supplierPrice / item.packSize).toFixed(2)}/unit
            </Text>
          )}
        </View>
        <View style={styles.priceDivider} />
        <View className="flex-1 items-center py-2">
          <Text className="text-xs text-gray-400 mb-0.5">
            Wholesale <Text className="text-[10px]">/ unit</Text>
          </Text>
          <Text className="text-sm font-semibold text-gray-700">
            ₱{item.wholesalePrice.toFixed(2)}
          </Text>
        </View>
        <View style={styles.priceDivider} />
        <View className="flex-1 items-center py-2">
          <Text className="text-xs text-gray-400 mb-0.5">
            Retail <Text className="text-[10px]">/ unit</Text>
          </Text>
          <Text className="text-sm font-semibold text-gray-700">
            ₱{item.retailPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
});

function buildSupplierSections(
  items: Item[],
  suppliers: Supplier[],
  itemSupplierMap: Record<number, number[]>,
): { title: string; supplierId: number | null; data: Item[] }[] {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const grouped = new Map<number | null, Item[]>();

  for (const item of items) {
    const supplierIds = itemSupplierMap[item.id];
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

  const sections: { title: string; supplierId: number | null; data: Item[] }[] =
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

function ItemList({
  items,
  suppliers,
  supplierItems,
  onEdit,
  onDelete,
  onHistory,
}: Props) {
  if (items.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-400 text-base">No items found</Text>
      </View>
    );
  }

  const sections = buildSupplierSections(items, suppliers, supplierItems);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item, index }) => (
        <ItemCard
          item={item}
          index={index}
          onEdit={onEdit}
          onDelete={onDelete}
          onHistory={onHistory}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  iconButton: {
    margin: 0,
  },
  priceDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 6,
  },
});

export default memo(ItemList);
