import { NetworkProvider } from "@/lib/NetworkContext";
import { SnackbarProvider } from "@/lib/SnackbarContext";
import { useGetExpenseCategories } from "@/services/useGetExpenseCategories";
import { useGetItemTypes } from "@/services/useGetItemTypes";
import { useGetPaymentModes } from "@/services/useGetPaymentModes";
import { useGetRecurringExpenses } from "@/services/useGetRecurringExpenses";
import { useGetUom } from "@/services/useGetUom";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider as PaperProvider } from "react-native-paper";
import { en, registerTranslation } from "react-native-paper-dates";
import "react-native-reanimated";
import "../global.css";
import { useAppTheme } from "../hooks/useAppTheme";
import { supabase } from "../lib/supabaseClient";
import { useGetItems } from "../services/useGetItems";
import { useGetSupplierItems } from "../services/useGetSupplierItems";
import { useGetSuppliers } from "../services/useGetSuppliers";

registerTranslation("en", en);

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const [queryClient] = useState(() => {
    const isAuthError = (error: unknown): boolean => {
      const msg = (error as Error)?.message ?? "";
      return (
        msg.includes("JWT expired") ||
        msg.includes("invalid JWT") ||
        msg.includes("Invalid JWT") ||
        msg.includes("not authenticated") ||
        msg.includes("Invalid Refresh Token") ||
        msg.includes("refresh_token_not_found")
      );
    };

    const handleAuthError = (error: unknown) => {
      if (isAuthError(error)) {
        supabase.auth.signOut();
      }
    };

    return new QueryClient({
      queryCache: new QueryCache({ onError: handleAuthError }),
      mutationCache: new MutationCache({ onError: handleAuthError }),
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: (failureCount, error) => {
            if (isAuthError(error)) return false;
            return failureCount < 2;
          },
        },
      },
    });
  });
  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // QueryClient and react-query hook will handle fetching items.

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useGetItems();
  useGetItemTypes();
  useGetUom();
  useGetSuppliers();
  useGetSupplierItems();
  useGetPaymentModes();
  useGetExpenseCategories();
  useGetRecurringExpenses();

  const appTheme = useAppTheme();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";

    if (!user && !inAuthGroup) {
      // Redirect to auth if not signed in
      router.replace("/auth");
    } else if (user && inAuthGroup) {
      // Redirect to tabs if signed in
      router.replace("/(tabs)");
    }
  }, [user, segments, loading]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <PaperProvider theme={appTheme}>
        <SnackbarProvider>
          <NetworkProvider>
            <BottomSheetModalProvider>
              <Stack>
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
            </BottomSheetModalProvider>
          </NetworkProvider>
        </SnackbarProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
