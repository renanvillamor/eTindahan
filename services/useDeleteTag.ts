import { supabase } from "@/lib/supabaseClient";
import { useMutation } from "@tanstack/react-query";

async function deleteTag(id: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("tag")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export function useDeleteTag() {
  return useMutation({ mutationFn: deleteTag });
}
