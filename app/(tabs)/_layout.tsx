import { useAppTheme } from "@/hooks/useAppTheme";
import { useNetwork } from "@/lib/NetworkContext";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const { colors } = useAppTheme();
  const { bottom, top } = useSafeAreaInsets();
  const { isConnected } = useNetwork();

  return (
    <View style={{ flex: 1 }}>
      {!isConnected && (
        <View
          style={{
            backgroundColor: "#991b1b",
            paddingTop: top,
            paddingBottom: 6,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <MaterialCommunityIcons
            name="wifi-off"
            size={13}
            color="rgba(255,255,255,0.85)"
          />
          <Text
            style={{
              color: "rgba(255,255,255,0.95)",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            No internet connection — sales are saved locally
          </Text>
        </View>
      )}
      <Tabs
        screenOptions={{
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: false, //useClientOnlyValue(false, true),
          tabBarStyle: {
            height: 80 + bottom,
            paddingBottom: bottom,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarItemStyle: { marginVertical: 10 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <MaterialIcons size={28} name="dashboard" color={color} />
            ),
            // headerRight: () => (
            //   <Link href="/modal" asChild>
            //     <Pressable>
            //       {({ pressed }) => (
            //         <FontAwesome
            //           name="info-circle"
            //           size={25}
            //           color={Colors[colorScheme ?? "light"].text}
            //           style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
            //         />
            //       )}
            //     </Pressable>
            //   </Link>
            // ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Inventory",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                size={28}
                name="store-search"
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Cart",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons size={28} name="cart" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                size={28}
                name="chart-bar"
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <MaterialIcons size={28} name="settings" color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
