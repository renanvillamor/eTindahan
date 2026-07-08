import { PaymentMode } from "@/models/PaymentMode";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

async function fetchPaymentModes(): Promise<PaymentMode[]> {
  const { data, error } = await supabase
    .from("payment_mode")
    .select("*")
    .order("mode", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    mode: row.mode ?? "",
    description: row.description ?? null,
    isDefault: row.is_default === true,
  }));
}

export function useGetPaymentModes() {
  const setPaymentModes = useStore((s) => s.setPaymentModes);

  const result = useQuery<PaymentMode[], Error>({
    queryKey: ["paymentModes"],
    queryFn: fetchPaymentModes,
    staleTime: 0,
  });

  useEffect(() => {
    if (result.data) {
      setPaymentModes(result.data);
    }
  }, [result.data, setPaymentModes]);

  return result;
}
