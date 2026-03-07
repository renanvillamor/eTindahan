import { Uom } from "@/models/Uom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function saveUom(uom: Uom): Promise<Uom> {
  const isNew = uom.id === 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    name: uom.name,
    description: uom.description ?? null,
    display_label: uom.displayLabel ?? null,
    pack_size: uom.packSize ?? null,
    ...(isNew ? { user_id: user.id } : {}),
  };

  if (isNew) {
    const { data, error } = await supabase
      .from("uom")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...uom, id: data.id };
  } else {
    const { error } = await supabase
      .from("uom")
      .update(payload)
      .eq("id", uom.id);
    if (error) throw new Error(error.message);
    return uom;
  }
}

export function useSaveUom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveUom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uoms"] });
    },
  });
}
