import { Item } from "@/models/Item";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function saveItem(item: Item): Promise<Item> {
  const isNew = item.id === 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const itemPayload = {
    name: item.name,
    description: item.description ?? null,
    type_id: item.typeId ?? null,
    is_active: item.isActive,
    ...(isNew ? { user_id: user.id } : {}),
  };

  let itemId: number;

  if (isNew) {
    const { data, error } = await supabase
      .from("item")
      .insert(itemPayload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    itemId = data.id;
  } else {
    const { error } = await supabase
      .from("item")
      .update(itemPayload)
      .eq("id", item.id);

    if (error) throw new Error(`item update: ${error.message}`);
    itemId = item.id;
  }

  // Save item_uom
  const uomPayload = {
    item_id: itemId,
    single_uom_id: item.singleUomId || null,
    pack_uom_id: item.packUomId || null,
  };

  if (isNew) {
    const { error } = await supabase.from("item_uom").insert(uomPayload);
    if (error) throw new Error(error.message);
  } else {
    const { error: uomError } = await supabase
      .from("item_uom")
      .update(uomPayload)
      .eq("item_id", itemId);
    if (uomError) throw new Error(`item_uom update: ${uomError.message}`);
  }

  // Save price
  const pricePayload = {
    item_id: itemId,
    supplier_price: item.supplierPrice,
    wholesale_price: item.wholesalePrice,
    retail_price: item.retailPrice,
    uom_id: item.singleUomId || null,
  };

  if (isNew) {
    const { error } = await supabase.from("price").insert(pricePayload);
    if (error) throw new Error(error.message);
  } else {
    const { error: priceError } = await supabase
      .from("price")
      .update(pricePayload)
      .eq("item_id", itemId);
    if (priceError) throw new Error(`price update: ${priceError.message}`);
  }

  return { ...item, id: itemId };
}

export function useSaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
