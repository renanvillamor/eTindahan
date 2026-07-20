import { syncPendingDeletions } from "@/services/useDeleteSale";
import { useSaveSale } from "@/services/useSaveSale";
import { useStore } from "@/store/useStore";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSnackbar } from "./SnackbarContext";

type NetworkContextValue = {
  isConnected: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  // Starts false (not true) so the very first NetInfo callback — which
  // fires immediately with the current connectivity state — is treated as
  // a "just came online" transition when the app launches already
  // connected. Otherwise offline sales/deletions from a crashed or
  // force-quit session sit unsynced forever unless the user happens to
  // toggle connectivity or open Settings → Sync Data manually.
  const wasConnected = useRef(false);
  const isSyncing = useRef(false);

  const queryClient = useQueryClient();
  const { showSnackbar } = useSnackbar();
  const { mutateAsync: saveSales } = useSaveSale();
  const clearUnsyncedSales = useStore((s) => s.clearUnsyncedSales);
  const clearDeletedSales = useStore((s) => s.clearDeletedSales);
  const setSalesToday = useStore((s) => s.setSalesToday);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const connected = state.isConnected === true;
      setIsConnected(connected);

      if (connected && !wasConnected.current) {
        // Just came back online
        wasConnected.current = true;

        // Auto-sync any unsynced sales and pending deletions
        if (!isSyncing.current) {
          const unsynced = useStore
            .getState()
            .salesToday.filter((s) => s.synced === false);
          const pendingDeletes = useStore
            .getState()
            .salesToday.filter((s) => s.pendingDelete === true && s.id > 0);

          if (unsynced.length > 0 || pendingDeletes.length > 0) {
            isSyncing.current = true;
            try {
              if (unsynced.length > 0) {
                await saveSales(unsynced);
                clearUnsyncedSales();
              }
              if (pendingDeletes.length > 0) {
                await syncPendingDeletions(pendingDeletes.map((s) => s.id));
                clearDeletedSales();
              }
              showSnackbar(
                `${unsynced.length + pendingDeletes.length} change(s) synced successfully.`,
                "success",
              );
            } catch {
              showSnackbar(
                "Auto-sync failed. Tap Sync Data in Settings to retry.",
                "error",
              );
            } finally {
              isSyncing.current = false;
            }
          }
        }

        // Re-fetch all master data so the app is up to date
        queryClient.invalidateQueries({
          queryKey: ["salesToday"],
          exact: false,
        });
        queryClient.invalidateQueries({ queryKey: ["items"] });
        queryClient.invalidateQueries({ queryKey: ["itemTypes"] });
        queryClient.invalidateQueries({ queryKey: ["uoms"] });
        queryClient.invalidateQueries({ queryKey: ["suppliers"] });
        queryClient.invalidateQueries({ queryKey: ["deliveries"] });
        queryClient.invalidateQueries({ queryKey: ["inventories"] });
      } else if (!connected && wasConnected.current) {
        wasConnected.current = false;
      }
    });

    return unsubscribe;
  }, [
    saveSales,
    clearUnsyncedSales,
    clearDeletedSales,
    setSalesToday,
    queryClient,
    showSnackbar,
  ]);

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
