import OptionSelectSheet, {
  SelectOption,
} from "@/app/components/shared/OptionSelectSheet";
import { formatCurrency } from "@/lib/utils";
import { ItemType } from "@/models/ItemType";
import { PaymentMode } from "@/models/PaymentMode";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, IconButton, Text, TextInput } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

// ── Shared types ───────────────────────────────────────────────────────────────

export type PaymentEntry = {
  entryId: string;
  paymentModeId: number | null;
  amount: string;
  sourceDate: string;
  sourceTypeId: number | null;
  remarks: string;
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

export function isCashMode(modeName: string): boolean {
  return /\bcash\b/i.test(modeName);
}

export function getTodayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function newEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── usePaymentEntries hook ─────────────────────────────────────────────────────

export function usePaymentEntries() {
  const [entries, setEntries] = useState<PaymentEntry[]>([]);

  const totalAmount = useMemo(
    () =>
      entries.reduce((sum, e) => {
        const n = parseFloat(e.amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [entries],
  );

  const addEntry = useCallback((prefillAmount?: number) => {
    setEntries((prev) => [
      ...prev,
      {
        entryId: newEntryId(),
        paymentModeId: null,
        amount:
          prefillAmount != null && prefillAmount > 0
            ? String(parseFloat(prefillAmount.toFixed(2)))
            : "",
        sourceDate: "",
        sourceTypeId: null,
        remarks: "",
      },
    ]);
  }, []);

  const updateEntry = useCallback((updated: PaymentEntry) => {
    setEntries((prev) =>
      prev.map((e) => (e.entryId === updated.entryId ? updated : e)),
    );
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.entryId !== entryId));
  }, []);

  const resetEntries = useCallback((newEntries: PaymentEntry[]) => {
    setEntries(newEntries);
  }, []);

  return {
    entries,
    totalAmount,
    addEntry,
    updateEntry,
    removeEntry,
    resetEntries,
  };
}

// ── PaymentEntryRow (internal) ─────────────────────────────────────────────────

function formatSourceDateLabel(iso: string): string {
  if (!iso) return " ";
  try {
    const dt = parseISO(iso);
    return isValid(dt) ? format(dt, "MMM d, yyyy") : " ";
  } catch {
    return " ";
  }
}

function PaymentEntryRow({
  entry,
  itemTypes,
  paymentModes,
  onUpdate,
  onRemove,
  onOpenDatePicker,
}: {
  entry: PaymentEntry;
  itemTypes: ItemType[];
  paymentModes: PaymentMode[];
  onUpdate: (updated: PaymentEntry) => void;
  onRemove: () => void;
  onOpenDatePicker: () => void;
}) {
  const selectedMode = paymentModes.find((m) => m.id === entry.paymentModeId);
  const selectedSourceType = itemTypes.find(
    (type) => type.id === entry.sourceTypeId,
  );
  const isCash = selectedMode ? isCashMode(selectedMode.mode) : false;

  const modeOptions: SelectOption[] = paymentModes.map((pm) => ({
    id: pm.id,
    label: pm.mode,
  }));
  const sourceTypeOptions: SelectOption[] = [
    { id: -1, label: "— None —" },
    ...itemTypes.map((type) => ({ id: type.id, label: type.description })),
  ];

  const handleModeSelect = (pm: PaymentMode) => {
    const becomingCash = isCashMode(pm.mode);
    onUpdate({
      ...entry,
      paymentModeId: pm.id,
      sourceDate: becomingCash ? entry.sourceDate || getTodayString() : "",
      sourceTypeId: becomingCash ? entry.sourceTypeId : null,
      remarks: becomingCash ? entry.remarks : "",
    });
  };

  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.topRow}>
        <View style={{ flex: 1.3 }}>
          <OptionSelectSheet
            label="Method"
            value={selectedMode?.mode ?? ""}
            options={modeOptions}
            dense
            onSelect={(opt) => {
              const pm = paymentModes.find((m) => m.id === opt.id);
              if (pm) handleModeSelect(pm);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            label="Amount"
            value={entry.amount}
            onChangeText={(v) =>
              onUpdate({ ...entry, amount: v.replace(/[^0-9.]/g, "") })
            }
            mode="outlined"
            keyboardType="numeric"
            dense
          />
        </View>
        <IconButton
          icon="close-circle-outline"
          size={18}
          onPress={onRemove}
          style={rowStyles.removeBtn}
        />
      </View>
      {isCash && (
        <View style={rowStyles.cashFields}>
          <TouchableOpacity onPress={onOpenDatePicker} activeOpacity={0.7}>
            <TextInput
              label="Source Date"
              value={formatSourceDateLabel(entry.sourceDate)}
              mode="outlined"
              editable={false}
              pointerEvents="none"
              dense
              right={
                <TextInput.Icon icon="calendar" onPress={onOpenDatePicker} />
              }
            />
          </TouchableOpacity>
          <OptionSelectSheet
            label="Source Type"
            value={selectedSourceType?.description ?? ""}
            options={sourceTypeOptions}
            dense
            onSelect={(opt) =>
              onUpdate({
                ...entry,
                sourceTypeId: opt.id === -1 ? null : opt.id,
              })
            }
          />
          <TextInput
            label="Remarks"
            value={entry.remarks || " "}
            onChangeText={(v) =>
              onUpdate({ ...entry, remarks: v.replace(/^ /, "") })
            }
            mode="outlined"
            multiline
            numberOfLines={2}
            dense
            style={rowStyles.remarksField}
          />
        </View>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  removeBtn: {
    margin: 0,
    marginLeft: -4,
  },
  cashFields: {
    marginTop: 8,
    gap: 8,
  },
  remarksField: {
    marginTop: 2,
  },
});

// ── PaymentMethodsSection ──────────────────────────────────────────────────────

type PaymentMethodsSectionProps = {
  entries: PaymentEntry[];
  paymentModes: PaymentMode[];
  itemTypes: ItemType[];
  remaining: number;
  onAdd: () => void;
  onUpdate: (entry: PaymentEntry) => void;
  onRemove: (entryId: string) => void;
};

export default function PaymentMethodsSection({
  entries,
  paymentModes,
  itemTypes,
  remaining,
  onAdd,
  onUpdate,
  onRemove,
}: PaymentMethodsSectionProps) {
  const [datePickerEntryId, setDatePickerEntryId] = useState<string | null>(
    null,
  );
  const datePickerEntry = entries.find((e) => e.entryId === datePickerEntryId);

  return (
    <>
      {entries.map((entry) => (
        <PaymentEntryRow
          key={entry.entryId}
          entry={entry}
          itemTypes={itemTypes}
          paymentModes={paymentModes}
          onUpdate={onUpdate}
          onRemove={() => onRemove(entry.entryId)}
          onOpenDatePicker={() => setDatePickerEntryId(entry.entryId)}
        />
      ))}
      <Button
        mode="outlined"
        icon="plus"
        onPress={onAdd}
        compact
        style={sectionStyles.addBtn}
      >
        Add Payment Method
      </Button>
      {entries.length > 0 && (
        <View className="flex-row justify-between mt-2 px-1">
          <Text className="text-xs text-gray-500">Remaining</Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: remaining <= 0.001 ? "#16a34a" : "#ef4444",
            }}
          >
            {remaining < -0.001
              ? `${formatCurrency(Math.abs(remaining))} overpaid`
              : formatCurrency(Math.max(0, remaining))}
          </Text>
        </View>
      )}
      <DatePickerModal
        locale="en"
        mode="single"
        visible={datePickerEntryId !== null}
        onDismiss={() => setDatePickerEntryId(null)}
        date={
          datePickerEntry?.sourceDate
            ? parseISO(datePickerEntry.sourceDate)
            : undefined
        }
        onConfirm={({ date }: { date: Date | undefined }) => {
          if (date && isValid(date) && datePickerEntry) {
            onUpdate({
              ...datePickerEntry,
              sourceDate: format(date, "yyyy-MM-dd"),
            });
          }
          setDatePickerEntryId(null);
        }}
        uppercase={false}
      />
    </>
  );
}

const sectionStyles = StyleSheet.create({
  addBtn: {
    marginTop: 4,
    marginBottom: 4,
  },
});
