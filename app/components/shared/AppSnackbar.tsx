import { useAppTheme } from "@/hooks/useAppTheme";
import { StyleSheet } from "react-native";
import { Snackbar } from "react-native-paper";

export type SnackbarVariant = "success" | "info" | "error";

type Props = {
  visible: boolean;
  message: string;
  variant?: SnackbarVariant;
  onDismiss: () => void;
};

export default function AppSnackbar({
  visible,
  message,
  variant = "info",
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();

  const bgColorMap: Record<SnackbarVariant, string> = {
    success: colors.primary,
    info: colors.inverseSurface,
    error: colors.error,
  };

  const textColorMap: Record<SnackbarVariant, string> = {
    success: colors.onPrimary,
    info: colors.inverseOnSurface,
    error: colors.onError,
  };

  const bgColor = bgColorMap[variant];
  const textColor = textColorMap[variant];

  return (
    <Snackbar
      visible={visible}
      onDismiss={onDismiss}
      duration={3000}
      style={[styles.snackbar, { backgroundColor: bgColor }]}
      theme={{
        colors: {
          inverseSurface: bgColor,
          inverseOnSurface: textColor,
        },
      }}
      action={{ label: "Dismiss", textColor, onPress: onDismiss }}
    >
      {message}
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    marginBottom: 8,
  },
});
