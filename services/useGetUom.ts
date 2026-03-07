import { Uom } from "@/models/Uom";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

async function fetchUoms(): Promise<Uom[]> {
  const { data, error } = await supabase.from("uom").select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    name: row.name ?? "",
    description: row.description ?? "",
    displayLabel: row.display_label ?? null,
    packSize: row.pack_size != null ? Number(row.pack_size) : null,
  }));
}

export function useGetUom() {
  const setUoms = useStore((s) => s.setUoms);

  const result = useQuery<Uom[], Error>({
    queryKey: ["uoms"],
    queryFn: fetchUoms,
    staleTime: 0,
  });

  useEffect(() => {
    if (result.data) {
      setUoms(result.data);
    }
  }, [result.data, setUoms]);

  return result;
}
