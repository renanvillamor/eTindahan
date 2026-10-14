import { Item } from "@/models/Item";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

type SaveItemInput = {
  item: Item;
  supplierIds: number[];
};

async function saveItem({ item, supplierIds }: SaveItemInput): Promise<Item> {
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
    min_threshold: item.minThreshold ?? null,
    max_threshold: item.maxThreshold ?? null,
    stock_quantity: item.stockQuantity ?? null,
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
    user_id: user.id,
  };

  const { data: updatedUoms, error: uomUpdateError } = await supabase
    .from("item_uom")
    .update(uomPayload)
    .eq("item_id", itemId)
    .select("item_id");
  if (uomUpdateError)
    throw new Error(`item_uom update: ${uomUpdateError.message}`);

  if (!updatedUoms || updatedUoms.length === 0) {
    const { error: uomInsertError } = await supabase
      .from("item_uom")
      .insert(uomPayload);
    if (uomInsertError)
      throw new Error(`item_uom insert: ${uomInsertError.message}`);
  }

  // Save price — insert a new row only when prices have actually changed
  const pricePayload = {
    item_id: itemId,
    supplier_price: item.supplierPrice,
    wholesale_price: item.wholesalePrice,
    retail_price: item.retailPrice,
    uom_id: item.singleUomId || null,
    user_id: user.id,
  };

  if (isNew) {
    const { error: priceError } = await supabase
      .from("price")
      .insert(pricePayload);
    if (priceError) throw new Error(`price insert: ${priceError.message}`);
  } else {
    const { data: latestPrice } = await supabase
      .from("price")
      .select("supplier_price, wholesale_price, retail_price")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const pricesChanged =
      !latestPrice ||
      Number(latestPrice.supplier_price) !== item.supplierPrice ||
      Number(latestPrice.wholesale_price) !== item.wholesalePrice ||
      Number(latestPrice.retail_price) !== item.retailPrice;

    if (pricesChanged) {
      const { error: priceError } = await supabase
        .from("price")
        .insert(pricePayload);
      if (priceError) throw new Error(`price insert: ${priceError.message}`);
    }
  }

  // Sync supplier_item: delete existing rows then insert new ones
  const { error: deleteSupplierItemError } = await supabase
    .from("supplier_item")
    .delete()
    .eq("item_id", itemId);
  if (deleteSupplierItemError)
    throw new Error(`supplier_item delete: ${deleteSupplierItemError.message}`);

  if (supplierIds.length > 0) {
    const { error: insertSupplierItemError } = await supabase
      .from("supplier_item")
      .insert(
        supplierIds.map((sid) => ({
          supplier_id: sid,
          item_id: itemId,
          user_id: user.id,
        })),
      );
    if (insertSupplierItemError)
      throw new Error(
        `supplier_item insert: ${insertSupplierItemError.message}`,
      );
  }

  return { ...item, id: itemId };
}

export function useSaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["supplierItems"] });
    },
  });
}
