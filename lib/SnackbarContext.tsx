import AppSnackbar, {
  SnackbarVariant,
} from "@/app/components/shared/AppSnackbar";
import React, { createContext, useCallback, useContext, useState } from "react";
import { View } from "react-native";

type SnackbarContextType = {
  showSnackbar: (message: string, variant?: SnackbarVariant) => void;
};

const SnackbarContext = createContext<SnackbarContextType>({
  showSnackbar: () => {},
});

type SnackbarState = {
  visible: boolean;
  message: string;
  variant: SnackbarVariant;
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    visible: false,
    message: "",
    variant: "info",
  });

  const showSnackbar = useCallback(
    (message: string, variant: SnackbarVariant = "info") => {
      setSnackbar({ visible: true, message, variant });
    },
    [],
  );

  const handleDismiss = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      <View style={{ flex: 1 }}>
        {children}
        <AppSnackbar
          visible={snackbar.visible}
          message={snackbar.message}
          variant={snackbar.variant}
          onDismiss={handleDismiss}
        />
      </View>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}
