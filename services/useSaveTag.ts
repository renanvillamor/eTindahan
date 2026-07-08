import { supabase } from "@/lib/supabaseClient";
import { Tag } from "@/models/Tag";
import { useMutation } from "@tanstack/react-query";

type SaveTagInput = Pick<Tag, "reference" | "tagName" | "tagType">;

async function saveTag(input: SaveTagInput): Promise<Tag> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("tag")
    .insert({
      reference: input.reference,
      tag_name: input.tagName,
      tag_type: input.tagType,
      user_id: user.id,
    })
    .select("id, reference, tag_name, tag_type, user_id")
    .single();

  if (error) throw new Error(error.message);

  return {
    id: Number(data.id),
    reference: data.reference as string,
    tagName: data.tag_name as string,
    tagType: data.tag_type as string,
    userId: data.user_id as string,
  };
}

export function useSaveTag() {
  return useMutation({ mutationFn: saveTag });
}
