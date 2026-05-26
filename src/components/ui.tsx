import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme, radii, spacing, typography } from "../theme";

type ScreenProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function Screen({ children, title, subtitle, footer, onRefresh, refreshing }: ScreenProps) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safeArea}>

      <ScrollView
        testID="screen-scroll-view"
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.card}>{children}</View>;
}

export function ActivityCard({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const styles = useStyles();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={({ pressed }: any) => [styles.activityCard, pressed && { opacity: 0.85 }]}>
      {children}
    </Wrapper>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  icon?: ReactNode;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  icon,
}: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.buttonShell,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={[colors.coral, colors.amber] as const}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.button, styles.button_primary]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.button, styles[`button_${variant}`]]}>{content}</View>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secureTextEntry = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "url";
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" || keyboardType === "phone-pad" || keyboardType === "url" ? "none" : "sentences"}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

export function LargeTextField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.largeInputLabel}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        style={styles.largeInput}
      />
    </View>
  );
}

export function AnimatedResultCard({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const scale = useMemo(() => new Animated.Value(0.8), []);
  const opacity = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.animatedResultCard, { transform: [{ scale }], opacity }]}>
      {children}
    </Animated.View>
  );
}

export function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmentWrap}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segmentOption, selected && styles.segmentOptionSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.small}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.tealSoft, false: colors.surfaceMuted }}
        thumbColor={value ? colors.teal : colors.muted}
      />
    </View>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "coral" | "amber" | "green";
}) {
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.small}>{body}</Text>
    </View>
  );
}

export function OptionPreview({
  title,
  note,
  imageUrl,
  price,
}: {
  title: string;
  note?: string | null;
  imageUrl?: string | null;
  price?: number | null;
}) {
  const styles = useStyles();
  return (
    <View style={styles.optionPreview}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.optionImage} /> : null}
      <View style={styles.optionBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {price ? <Text style={styles.small}>£{price.toFixed(2)}</Text> : null}
        {note ? <Text style={styles.small}>{note}</Text> : null}
      </View>
    </View>
  );
}



export function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    screen: {
      gap: spacing.lg,
      padding: spacing.xl,
      paddingBottom: spacing.xxl + spacing.xl,
    },
    footer: {
      backgroundColor: "transparent",
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    header: {
      gap: spacing.md,
      paddingTop: spacing.sm,
    },
    title: {
      ...typography.title,
      color: colors.ink,
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    subtitle: {
      ...typography.body,
      color: colors.muted,
      maxWidth: 320,
    },
    markerAccent: {
      backgroundColor: colors.coral,
      borderColor: colors.ink,
      borderRadius: 999,
      borderWidth: 2,
      height: 12,
      transform: [{ rotate: "-5deg" }],
      width: 82,
    },
    brandRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    brandIcon: {
      borderRadius: 12,
      height: 54,
      resizeMode: "contain",
      width: 54,
    },
    brandText: {
      flex: 1,
      gap: spacing.xs,
    },
    homeBrand: {
      alignItems: "flex-start",
      marginBottom: spacing.sm,
    },
    homeBrandIcon: {
      height: 56,
      width: 72,
      resizeMode: "contain",
    },
    inlineActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    dividerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    dividerLine: {
      backgroundColor: colors.ink,
      flex: 1,
      height: 2,
      opacity: 0.16,
    },
    textButton: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    textButtonLabel: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "900",
      textDecorationLine: "underline",
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: radii.xl,
      borderWidth: 2,
      gap: spacing.lg,
      padding: spacing.xl,
      shadowColor: colors.ink,
      shadowOffset: { width: 6, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 0,
      elevation: 6,
    },
    activityCard: {
      backgroundColor: colors.coralSoft,
      borderColor: colors.ink,
      borderRadius: radii.xl + 4,
      borderWidth: 3,
      padding: spacing.xl,
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 0,
      elevation: 4,
    },
    buttonShell: {
      borderRadius: 999,
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 0,
      elevation: 5,
    },
    button: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 58,
      paddingHorizontal: spacing.xl,
    },
    button_primary: {
      borderColor: "rgba(255, 255, 255, 0.28)",
    },
    button_secondary: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderWidth: 2,
    },
    button_ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    button_danger: {
      backgroundColor: colors.coralSoft,
      borderColor: colors.ink,
      borderWidth: 2,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonIcon: {
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    buttonText_primary: {
      color: "#FFFFFF",
    },
    buttonText_secondary: {
      color: colors.ink,
    },
    buttonText_ghost: {
      color: colors.ink,
    },
    buttonText_danger: {
      color: colors.danger,
    },
    pressed: {
      opacity: 0.78,
    },
    field: {
      gap: spacing.sm,
    },
    label: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: "800",
    },
    input: {
      backgroundColor: "#FFFFFF",
      borderColor: colors.ink,
      borderRadius: radii.lg,
      borderWidth: 2,
      color: colors.ink,
      fontSize: 16,
      fontWeight: "700",
      minHeight: 54,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    largeInput: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 24,
      borderWidth: 3,
      color: colors.ink,
      fontSize: 28,
      fontWeight: "900",
      minHeight: 80,
      padding: spacing.lg,
      textAlign: "center",
      lineHeight: 34,
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      elevation: 6,
    },
    largeInputLabel: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    inputMultiline: {
      minHeight: 96,
      textAlignVertical: "top",
    },
    segmentWrap: {
      flexDirection: "row",
      gap: spacing.xs,
      backgroundColor: colors.coralSoft,
      borderColor: colors.ink,
      borderWidth: 2,
      borderRadius: 999,
      padding: spacing.xs,
    },
    segmentOption: {
      backgroundColor: "transparent",
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 0,
      flex: 1,
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    segmentOptionSelected: {
      backgroundColor: colors.coral,
      shadowColor: colors.ink,
      shadowOffset: { width: 2, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      elevation: 2,
    },
    segmentText: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "900",
    },
    segmentTextSelected: {
      color: "#FFFFFF",
    },
    toggleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
    },
    toggleText: {
      flex: 1,
      gap: spacing.xs,
    },
    rowTitle: {
      ...typography.h2,
      color: colors.ink,
    },
    small: {
      ...typography.small,
      color: colors.muted,
    },
    pill: {
      alignSelf: "flex-start",
      borderColor: colors.ink,
      borderRadius: 999,
      borderWidth: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    pill_neutral: {
      backgroundColor: colors.butter,
    },
    pill_teal: {
      backgroundColor: colors.tealSoft,
    },
    pill_coral: {
      backgroundColor: colors.coralSoft,
    },
    pill_amber: {
      backgroundColor: colors.amberSoft,
    },
    pill_green: {
      backgroundColor: colors.greenSoft,
    },
    pillText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    empty: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: radii.xl,
      borderWidth: 2,
      gap: spacing.sm,
      padding: spacing.xl,
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 0,
      elevation: 4,
    },
    animatedResultCard: {
      backgroundColor: colors.coralSoft,
      borderColor: colors.ink,
      borderRadius: radii.xl + 12,
      borderWidth: 4,
      gap: spacing.lg,
      padding: spacing.xxl,
      shadowColor: colors.ink,
      shadowOffset: { width: 6, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      elevation: 8,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 280,
    },
    previewPanel: {
      backgroundColor: colors.butter,
      borderColor: colors.ink,
      borderRadius: radii.lg,
      borderWidth: 2,
      gap: spacing.sm,
      padding: spacing.lg,
    },
    optionPreview: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: radii.xl,
      borderWidth: 2,
      flexDirection: "row",
      gap: spacing.md,
      overflow: "hidden",
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 0,
      elevation: 4,
    },
    optionImage: {
      backgroundColor: colors.coralSoft,
      height: 104,
      width: 104,
    },
    optionBody: {
      flex: 1,
      gap: spacing.xs,
      justifyContent: "center",
      padding: spacing.md,
    },
    tabBar: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 999,
      borderWidth: 2,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "space-between",
      maxWidth: 390,
      padding: spacing.xs,
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      width: "100%",
      elevation: 6,
    },
    tabItem: {
      alignItems: "center",
      borderRadius: 999,
      flex: 1,
      justifyContent: "center",
      minHeight: 48,
    },
    tabItemActive: {
      backgroundColor: colors.coralSoft,
    },
  }), [colors]);
}
