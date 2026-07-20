import { DEFAULT_STALE_TIME } from "@/lib/queryConfig";
import { supabase } from "@/lib/supabaseClient";
import { Tag } from "@/models/Tag";
import { useQuery } from "@tanstack/react-query";

async function fetchTags(tagType: string, reference: string): Promise<Tag[]> {
  // getSession() reads the cached session locally; getUser() would hit the
  // Supabase Auth server over the network for no benefit here.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from("tag")
    .select("id, reference, tag_name, tag_type, user_id")
    .eq("tag_type", tagType)
    .eq("reference", reference)
    .eq("user_id", user.id)
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    reference: row.reference as string,
    tagName: row.tag_name as string,
    tagType: row.tag_type as string,
    userId: row.user_id as string,
  }));
}

export function useGetTags(tagType: string, reference: string) {
  return useQuery<Tag[], Error>({
    queryKey: ["tags", tagType, reference],
    queryFn: () => fetchTags(tagType, reference),
    enabled: !!tagType && !!reference,
    staleTime: DEFAULT_STALE_TIME,
  });
}
