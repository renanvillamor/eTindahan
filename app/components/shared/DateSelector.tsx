import { addDays, format, subDays } from "date-fns";
import { View } from "react-native";
import { IconButton, Text } from "react-native-paper";

type DateSelectorProps = {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
};

export default function DateSelector({
  label = "Date",
  value,
  onChange,
}: DateSelectorProps) {
  return (
    <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
      <IconButton
        icon="chevron-left"
        size={24}
        onPress={() => onChange(subDays(value, 1))}
      />
      <View className="items-center">
        <Text className="text-xs text-gray-400 uppercase tracking-wide">
          {label}
        </Text>
        <Text className="text-base font-semibold text-gray-800">
          {format(value, "MMMM d, yyyy")}
        </Text>
      </View>
      <IconButton
        icon="chevron-right"
        size={24}
        onPress={() => onChange(addDays(value, 1))}
      />
    </View>
  );
}
