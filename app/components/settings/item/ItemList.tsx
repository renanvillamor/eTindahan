import { CARD_COLORS } from "@/constants/Constants";
import { Item } from "@/models/Item";
import { memo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { IconButton } from "react-native-paper";

type Props = {
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (itemId: number) => void;
};

type CardProps = {
  item: Item;
  index: number;
  onEdit: (item: Item) => void;
  onDelete: (itemId: number) => void;
};

const ItemCard = memo(function ItemCard({
  item,
  index,
  onEdit,
  onDelete,
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
          <Text className="text-xs text-gray-400 mb-0.5">Supplier</Text>
          <Text className="text-sm font-semibold text-gray-700">
            ₱{item.supplierPrice.toFixed(2)}
          </Text>
        </View>
        <View style={styles.priceDivider} />
        <View className="flex-1 items-center py-2">
          <Text className="text-xs text-gray-400 mb-0.5">Wholesale</Text>
          <Text className="text-sm font-semibold text-gray-700">
            ₱{item.wholesalePrice.toFixed(2)}
          </Text>
        </View>
        <View style={styles.priceDivider} />
        <View className="flex-1 items-center py-2">
          <Text className="text-xs text-gray-400 mb-0.5">Retail</Text>
          <Text className="text-sm font-semibold text-gray-700">
            ₱{item.retailPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
});

function ItemList({ items, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-400 text-base">No items found</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      renderItem={({ item, index }) => (
        <ItemCard
          item={item}
          index={index}
          onEdit={onEdit}
          onDelete={onDelete}
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
