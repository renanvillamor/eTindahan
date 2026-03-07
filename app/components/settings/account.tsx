import { useAppTheme } from "@/hooks/useAppTheme";
import { supabase } from "@/lib/supabaseClient";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  Divider,
  Icon,
  IconButton,
  List,
  Text,
} from "react-native-paper";

export default function AccountScreen() {
  const { colors } = useAppTheme();
  const styles = useStyles(colors);
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setUid(user?.id ?? null);
    });
  }, []);

  const initials = email ? email.slice(0, 2).toUpperCase() : "?";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Account",
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
        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <Avatar.Text
            size={72}
            label={initials}
            style={{ backgroundColor: colors.primary }}
            labelStyle={styles.avatarLabel}
          />
          <Text style={styles.avatarEmail}>{email ?? "—"}</Text>
          {uid && (
            <Text style={styles.avatarUid} numberOfLines={1}>
              UID: {uid}
            </Text>
          )}
        </View>

        {/* Profile section */}
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.group}>
          <List.Item
            title="Email"
            titleStyle={styles.rowTitle}
            description={email ?? "Not signed in"}
            descriptionStyle={styles.rowDesc}
            style={styles.row}
            left={() => (
              <View style={[styles.iconCircle, { backgroundColor: "#2196F3" }]}>
                <Icon source="email-outline" size={18} color="#fff" />
              </View>
            )}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="Change Password"
            titleStyle={styles.rowTitle}
            description="Update your account password"
            descriptionStyle={styles.rowDesc}
            style={styles.row}
            left={() => (
              <View style={[styles.iconCircle, { backgroundColor: "#FF9800" }]}>
                <Icon source="lock-reset" size={18} color="#fff" />
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
        </View>

        {/* Session */}
        <Text style={styles.sectionLabel}>Session</Text>
        <View style={styles.group}>
          <List.Item
            title="Sign Out"
            titleStyle={[styles.rowTitle, styles.signOutText]}
            description="You will be returned to the login screen"
            descriptionStyle={styles.rowDesc}
            style={styles.row}
            left={() => (
              <View style={[styles.iconCircle, { backgroundColor: "#F44336" }]}>
                <Icon source="logout" size={18} color="#fff" />
              </View>
            )}
            onPress={handleSignOut}
          />
        </View>

        <Button
          mode="outlined"
          onPress={handleSignOut}
          style={styles.signOutButton}
          textColor="#F44336"
        >
          Sign Out
        </Button>
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
    avatarCard: {
      backgroundColor: "#fff",
      borderRadius: 16,
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    avatarLabel: {
      fontSize: 26,
      fontWeight: "700",
      color: "#fff",
    },
    avatarEmail: {
      marginTop: 12,
      fontSize: 16,
      fontWeight: "600",
      color: "#1a1a1a",
    },
    avatarUid: {
      marginTop: 4,
      fontSize: 11,
      color: "#9E9E9E",
      maxWidth: 260,
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
    signOutText: {
      color: "#F44336",
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
    signOutButton: {
      borderColor: "#F44336",
      borderRadius: 12,
    },
  });
