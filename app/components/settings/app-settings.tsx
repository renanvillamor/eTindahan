import { useAppTheme } from "@/hooks/useAppTheme";
import { router, Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, IconButton, List, Text } from "react-native-paper";

type SettingRow = {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
};

const APP_SETTINGS: SettingRow[] = [
  {
    icon: "bell-outline",
    iconColor: "#FF9800",
    title: "Notifications",
    description: "Manage alerts and push notifications",
  },
  {
    icon: "translate",
    iconColor: "#2196F3",
    title: "Language",
    description: "English (default)",
  },
  {
    icon: "theme-light-dark",
    iconColor: "#607D8B",
    title: "Appearance",
    description: "Light theme",
  },
  {
    icon: "shield-lock-outline",
    iconColor: "#4CAF50",
    title: "Privacy & Security",
    description: "Data permissions and security settings",
  },
];

const ABOUT: SettingRow[] = [
  {
    icon: "information-outline",
    iconColor: "#9C27B0",
    title: "App Version",
    description: "1.0.0",
  },
  {
    icon: "file-document-outline",
    iconColor: "#00BCD4",
    title: "Terms of Service",
    description: "Read our terms and conditions",
  },
  {
    icon: "lock-outline",
    iconColor: "#3F51B5",
    title: "Privacy Policy",
    description: "How we handle your data",
  },
];

export default function AppSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);

  return (
    <>
      <Stack.Screen
        options={{
          title: "App Settings",
          headerTitleAlign: "center",
          animation: "slide_from_right",
          headerLeft: () => (
            <View className="w-12 h-12 items-center justify-center -ml-2">
              <IconButton
                icon="arrow-left"
                size={24}
                onPress={() => router.back()}
                accessibilityLabel="Back"
                className="m-0"
              />
            </View>
          ),
        }}
      />

      <ScrollView
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.group}>
          {APP_SETTINGS.map((item, i) => (
            <View key={item.title}>
              <List.Item
                title={item.title}
                titleStyle={styles.rowTitle}
                description={item.description}
                descriptionStyle={styles.rowDesc}
                style={styles.row}
                left={() => (
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: item.iconColor },
                    ]}
                  >
                    <Icon source={item.icon} size={18} color="#fff" />
                  </View>
                )}
                right={() => (
                  <View className="justify-center">
                    <Icon
                      source="chevron-right"
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                  </View>
                )}
                onPress={() => {}}
              />
              {i < APP_SETTINGS.length - 1 && (
                <Divider style={styles.divider} />
              )}
            </View>
          ))}
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.group}>
          {ABOUT.map((item, i) => (
            <View key={item.title}>
              <List.Item
                title={item.title}
                titleStyle={styles.rowTitle}
                description={item.description}
                descriptionStyle={styles.rowDesc}
                style={styles.row}
                left={() => (
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: item.iconColor },
                    ]}
                  >
                    <Icon source={item.icon} size={18} color="#fff" />
                  </View>
                )}
                right={() => (
                  <View className="justify-center">
                    <Icon
                      source="chevron-right"
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                  </View>
                )}
                onPress={() => {}}
              />
              {i < ABOUT.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: "#9E9E9E",
      textTransform: "uppercase",
      marginBottom: 6,
      marginLeft: 4,
    },
    group: {
      backgroundColor: "#fff",
      borderRadius: 14,
      marginBottom: 20,
      overflow: "hidden",
    },
    row: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: "#1a1a1a",
    },
    rowDesc: {
      fontSize: 12,
      color: "#9E9E9E",
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginRight: 4,
    },
    divider: {
      marginLeft: 64,
    },
  });
