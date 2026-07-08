import { useSnackbar } from "@/lib/SnackbarContext";
import { useDeleteTag } from "@/services/useDeleteTag";
import { useGetTags } from "@/services/useGetTags";
import { useSaveTag } from "@/services/useSaveTag";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  TextInput,
} from "react-native-paper";

type Props = {
  tagType: string;
  reference: string;
  defaultTagName?: string;
};

export default function TagBar({
  tagType,
  reference,
  defaultTagName = "",
}: Props) {
  const { showSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [tagName, setTagName] = useState("");

  const { data: tags = [], isLoading: tagsLoading } = useGetTags(
    tagType,
    reference,
  );
  const saveTag = useSaveTag();
  const deleteTag = useDeleteTag();

  const handleOpen = () => {
    setTagName(defaultTagName);
    setDialogVisible(true);
  };

  const handleDismiss = () => {
    setDialogVisible(false);
    setTagName("");
  };

  const handleSave = () => {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    handleDismiss();
    saveTag.mutate(
      { reference, tagName: trimmed, tagType },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: ["tags", tagType, reference],
          }),
        onError: (err) => showSnackbar(err.message, "error"),
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteTag.mutate(id, {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: ["tags", tagType, reference],
        }),
      onError: (err) => showSnackbar(err.message, "error"),
    });
  };

  return (
    <>
      <View style={styles.bar}>
        <IconButton
          icon="tag-plus-outline"
          size={22}
          onPress={handleOpen}
          disabled={saveTag.isPending || deleteTag.isPending || tagsLoading}
          accessibilityLabel="Add tag"
          style={styles.iconButton}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              onClose={() => handleDelete(tag.id)}
              closeIcon="close"
              style={styles.chip}
              textStyle={styles.chipText}
              disabled={deleteTag.isPending}
            >
              {tag.tagName}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDismiss}>
          <Dialog.Title>Add Tag</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Tag name"
              value={tagName}
              onChangeText={setTagName}
              mode="outlined"
              autoFocus
              onSubmitEditing={handleSave}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDismiss}>Cancel</Button>
            <Button onPress={handleSave} disabled={!tagName.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: 20,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  iconButton: {
    margin: 0,
  },
  chip: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  chipText: {
    color: "#15803D",
    fontSize: 13,
  },
});
