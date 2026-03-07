import { useAppTheme } from "@/hooks/useAppTheme";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, Text, TouchableRipple } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

type Props = {
  fromDate: Date;
  toDate: Date;
  maxDays?: number;
  onChange: (from: Date, to: Date) => void;
};

export default function DateRangePicker({
  fromDate,
  toDate,
  maxDays = 5,
  onChange,
}: Props) {
  const { colors } = useAppTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const onDismiss = useCallback(() => setPickerOpen(false), []);

  const onConfirm = useCallback(
    ({
      startDate,
      endDate,
    }: {
      startDate: Date | undefined;
      endDate: Date | undefined;
    }) => {
      setPickerOpen(false);
      if (!startDate) return;
      let from = startDate;
      let to = endDate ?? startDate;
      if (differenceInCalendarDays(to, from) >= maxDays) {
        to = addDays(from, maxDays - 1);
      }
      onChange(from, to);
    },
    [maxDays, onChange],
  );

  return (
    <>
      <TouchableRipple
        onPress={() => setPickerOpen(true)}
        rippleColor="rgba(0,0,0,0.06)"
        style={styles.btn}
      >
        <View style={styles.inner}>
          <View style={styles.iconWrapper}>
            <Icon source="calendar-range" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.text, { color: colors.onSurface }]}>
            {format(fromDate, "MMM d")} – {format(toDate, "MMM d, yyyy")}
          </Text>
        </View>
      </TouchableRipple>

      <DatePickerModal
        locale="en"
        mode="range"
        visible={pickerOpen}
        onDismiss={onDismiss}
        startDate={fromDate}
        endDate={toDate}
        onConfirm={onConfirm}
        label={`Select date range (max ${maxDays} days)`}
        startLabel="From"
        endLabel="To"
        uppercase={false}
        validRange={{ endDate: new Date() }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconWrapper: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
