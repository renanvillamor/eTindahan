import { Supplier } from "@/models/Supplier";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function saveSupplier(supplier: Supplier): Promise<Supplier> {
  const isNew = supplier.id === 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    name: supplier.name,
    description: supplier.description ?? null,
    contact_no: supplier.contactNo ?? null,
    ...(isNew ? { user_id: user.id } : {}),
  };

  if (isNew) {
    const { data, error } = await supabase
      .from("supplier")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...supplier, id: data.id };
  } else {
    const { error } = await supabase
      .from("supplier")
      .update(payload)
      .eq("id", supplier.id);
    if (error) throw new Error(error.message);
    return supplier;
  }
}

export function useSaveSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
