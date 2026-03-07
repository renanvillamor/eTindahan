import { ItemType } from "@/models/ItemType";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

async function fetchItemTypes(): Promise<ItemType[]> {
  const { data, error } = await supabase.from("item_type").select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    description: row.description ?? null,
  }));
}

export function useGetItemTypes() {
  const setItemTypes = useStore((s) => s.setItemTypes);

  const result = useQuery<ItemType[], Error>({
    queryKey: ["itemTypes"],
    queryFn: fetchItemTypes,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (result.data) {
      setItemTypes(result.data);
    }
  }, [result.data, setItemTypes]);

  return result;
}
