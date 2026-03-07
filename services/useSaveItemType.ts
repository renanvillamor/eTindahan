import { ItemType } from "@/models/ItemType";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function saveItemType(itemType: ItemType): Promise<ItemType> {
  const isNew = itemType.id === 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    description: itemType.description,
    ...(isNew ? { user_id: user.id } : {}),
  };

  if (isNew) {
    const { data, error } = await supabase
      .from("item_type")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...itemType, id: data.id };
  } else {
    const { error } = await supabase
      .from("item_type")
      .update(payload)
      .eq("id", itemType.id);
    if (error) throw new Error(error.message);
    return itemType;
  }
}

export function useSaveItemType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveItemType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itemTypes"] });
    },
  });
}
