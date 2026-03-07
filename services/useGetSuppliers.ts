import { Supplier } from "@/models/Supplier";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from("supplier").select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    name: row.name,
    description: row.description ?? null,
    contactNo: row.contact_no ?? null,
  }));
}

export function useGetSuppliers() {
  const setSuppliers = useStore((s: any) => s.setSuppliers);

  const result = useQuery<Supplier[], Error>({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (result.data) {
      setSuppliers(result.data);
    }
  }, [result.data, setSuppliers]);

  return result;
}
