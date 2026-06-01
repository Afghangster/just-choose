import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useTheme, radii, spacing, typography } from "../theme";

type ScreenProps = {
  children: ReactNode;
  title?: string;
  titleImage?: any;
  titleVariant?: "title" | "h1";
  subtitle?: string;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  safeAreaEdges?: Edge[];
  headerRight?: ReactNode;
};

export function Screen({ children, title, titleImage, titleVariant = "title", subtitle, footer, onRefresh, refreshing, safeAreaEdges, headerRight }: ScreenProps) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>

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
        {title || titleImage || headerRight ? (
          <View style={styles.header}>
            {titleImage ? <Image source={titleImage} style={{ height: 64, resizeMode: "contain" }} /> : null}
            {title ? <Text style={[styles.title, titleVariant === "h1" && styles.titleH1, headerRight ? { paddingHorizontal: 40 } : null]}>{title}</Text> : null}
            {headerRight ? (
              <View style={styles.headerRightContainer}>
                {headerRight}
              </View>
            ) : null}
          </View>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: any }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
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
        <View style={[styles.button, styles.button_primary]}>
          {content}
        </View>
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
  style,
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "coral" | "amber" | "green";
  style?: any;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.pill, styles[`pill_${tone}`], style]}>
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

export function Avatar({ name, size = 54, imageUrl }: { name: string; size?: number; imageUrl?: string | null }) {
  const { colors } = useTheme();
  const initials = name
    ? name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.coral,
      overflow: 'hidden',
    }}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{
          color: colors.coral,
          fontSize: size * 0.4,
          fontWeight: '900',
        }}>
          {initials}
        </Text>
      )}
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
      alignItems: "center",
      position: "relative",
    },
    headerRightContainer: {
      position: "absolute",
      right: 0,
      top: spacing.sm,
      justifyContent: "flex-start",
    },
    title: {
      ...typography.title,
      color: colors.ink,
      letterSpacing: 0,
      textTransform: "uppercase",
      textAlign: "center",
    },
    titleH1: {
      ...typography.h1,
    },
    subtitle: {
      ...typography.body,
      color: colors.muted,
      maxWidth: 320,
      textAlign: "center",
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
      shadowColor: "#000000",
      shadowOffset: { width: 6, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 0,
      elevation: 6,
    },
    activityCard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      padding: spacing.md,
      shadowColor: colors.muted,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 1,
    },
    buttonShell: {
      borderRadius: 999,
      shadowColor: "#000000",
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
      backgroundColor: "#FF5A5F",
      borderColor: "#FF5A5F",
      borderWidth: 2,
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
      backgroundColor: colors.dangerSoft,
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
      borderRadius: 12,
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
      shadowColor: "#000000",
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
      shadowColor: "#000000",
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
      shadowColor: "#000000",
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
      shadowColor: "#000000",
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
      shadowColor: "#000000",
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
      shadowColor: "#000000",
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
      minHeight: 42,
    },
    tabItemActive: {
      backgroundColor: colors.activeTabBg,
    },
  }), [colors]);
}

export function useDecisionGridStyles() {
  const { colors } = useTheme();

  return useMemo(() => StyleSheet.create({
    section: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
    },
    card: {
      borderColor: colors.ink,
      borderRadius: 24,
      borderWidth: 3,
      gap: spacing.sm,
      padding: spacing.md,
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 5 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      width: "46%",
      aspectRatio: 0.9,
      elevation: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    cardSelected: {
      transform: [{ scale: 1.05 }],
      shadowOffset: { width: 6, height: 8 },
      borderWidth: 4,
    },
    cardDimmed: {
      transform: [{ scale: 0.95 }],
      opacity: 0.5,
    },
    imageArea: {
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.66)",
      borderColor: colors.ink,
      borderRadius: 16,
      borderWidth: 2,
      flex: 1,
      justifyContent: "center",
      overflow: "hidden",
      width: "100%",
    },
    imagePlaceholder: {
      backgroundColor: "rgba(255, 255, 255, 0.4)",
    },
    image: {
      height: "100%",
      width: "100%",
    },
    optionTitle: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: "900",
      textAlign: "center",
    },
  }), [colors]);
}

export function isColorDark(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b) < 127.5;
}

export type DecisionGridOption = {
  id: string;
  title?: string | null;
  label: string;
  imageUrl?: string | null;
};

type DecisionGridProps = {
  options: DecisionGridOption[];
  activeId?: string | null;
  onOptionSelect?: (id: string) => void;
  viewOnly?: boolean;
};

export function DecisionGrid({ options, activeId, onOptionSelect, viewOnly = false }: DecisionGridProps) {
  const gridStyles = useDecisionGridStyles();
  const { colors } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const cardColors = useMemo(() => [colors.coral, colors.butter, colors.mint, colors.blueSoft, colors.peach, colors.purpleSoft], [colors]);

  return (
    <View style={gridStyles.section}>
      {options.map((option, index) => {
        const isSelected = activeId === option.id;
        const isDimmed = !viewOnly && activeId && !isSelected;

        return (
          <Pressable
            key={option.id}
            onPress={() => !viewOnly && onOptionSelect?.(option.id)}
            onLongPress={() => {
              if (option.title || option.label) {
                setExpandedIndex(index);
              }
            }}
            style={[
              gridStyles.card,
              { backgroundColor: cardColors[index % cardColors.length] },
              isSelected && !viewOnly && gridStyles.cardSelected,
              isDimmed && gridStyles.cardDimmed,
              option.imageUrl ? { justifyContent: "space-between" } : null,
            ]}
          >
            {option.imageUrl ? (
              <View style={[gridStyles.imageArea, !option.title ? { flex: 1, height: undefined } : null]}>
                <Image source={{ uri: option.imageUrl }} style={gridStyles.image} />
              </View>
            ) : null}
            {!option.imageUrl || option.title ? (
              <View style={!option.imageUrl ? { flex: 1, justifyContent: "center" } : undefined}>
                <Text style={[
                  gridStyles.optionTitle, 
                  { fontSize: (option.title || option.label).length > 20 ? 18 : 22 },
                  { color: isColorDark(cardColors[index % cardColors.length]) ? "#FFFFFF" : colors.ink }
                ]} numberOfLines={3}>
                  {option.title || (!option.imageUrl ? option.label : "")}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      <ExpandedCardModal 
        option={expandedIndex !== null ? options[expandedIndex] : null}
        color={expandedIndex !== null ? cardColors[expandedIndex % cardColors.length] : colors.surface}
        visible={expandedIndex !== null}
        onClose={() => setExpandedIndex(null)}
      />
    </View>
  );
}

export function QuestionArea({ question, comment }: { question?: string | null; comment?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const { colors } = useTheme();
  const styles = useStyles();

  if (!question && !comment) return null;

  const len = question?.length || 0;
  const isShort = len < 50;
  const isMedium = len >= 50 && len < 90;
  
  const textStyle = [
    styles.title,
    isMedium && { fontSize: 28, lineHeight: 32 },
    !isShort && !isMedium && { fontSize: 22, lineHeight: 28 }
  ];

  const handleTextLayout = (e: NativeSyntheticEvent<any>) => {
    if (!expanded) {
      // If the layout engine had to truncate the lines based on numberOfLines
      // Some React Native versions pass `didExceedMaxLines` or we check lines length
      // Actually `onTextLayout` fires with all lines if not truncated, or exactly 4 lines if truncated and it would have been more
      // Wait, `onTextLayout` reports the lines that are rendered. 
      // A safer check is if we see 4 lines, we just assume it MIGHT be truncated, or use a heuristic.
      // Better heuristic: if len > 120 and lines.length >= 4.
      if (e.nativeEvent.lines.length >= 4 && len > 100) {
        setIsTruncated(true);
      }
    }
  };

  return (
    <View style={{ gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
      {question ? (
        <View>
          <Text 
            style={textStyle} 
            numberOfLines={expanded ? undefined : 4}
            onTextLayout={handleTextLayout}
          >
            {question}
          </Text>
          {isTruncated && !expanded && (
            <Pressable onPress={() => setExpanded(true)} hitSlop={12} style={{ marginTop: spacing.sm }}>
              <Text style={{ fontSize: 16, color: colors.teal, fontWeight: "900", textTransform: "uppercase", textAlign: "center" }}>
                Read more
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {comment ? (
        <Text style={[styles.subtitle, { alignSelf: "center", marginTop: spacing.xs }]}>
          {comment}
        </Text>
      ) : null}
    </View>
  );
}


export function useDecisionCarouselStyles() {
  const { colors } = useTheme();

  return useMemo(() => StyleSheet.create({
    section: {
      gap: spacing.md,
    },
    card: {
      borderColor: colors.ink,
      borderRadius: 34,
      borderWidth: 3,
      gap: spacing.md,
      padding: spacing.lg,
      shadowColor: colors.ink,
      shadowOffset: { width: 7, height: 9 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      width: 258,
      elevation: 6,
      alignItems: "center",
    },
    cardSelected: {
      transform: [{ scale: 1.05 }],
      shadowOffset: { width: 9, height: 11 },
      borderWidth: 4,
    },
    cardDimmed: {
      transform: [{ scale: 0.95 }],
      opacity: 0.5,
    },
    imageArea: {
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.66)",
      borderColor: colors.ink,
      borderRadius: 28,
      borderWidth: 2,
      height: 180,
      justifyContent: "center",
      overflow: "hidden",
      width: "100%",
    },
    imagePlaceholder: {
      backgroundColor: "rgba(255, 255, 255, 0.4)",
    },
    image: {
      height: "100%",
      width: "100%",
    },
    optionTitle: {
      color: colors.ink,
      fontWeight: "900",
      textAlign: "center",
    },
  }), [colors]);
}

type DecisionCarouselProps = {
  options: DecisionGridOption[];
  activeId?: string | null;
  onOptionSelect?: (id: string) => void;
  viewOnly?: boolean;
};

export function DecisionCarousel({ options, activeId, onOptionSelect, viewOnly = false }: DecisionCarouselProps) {
  const carouselStyles = useDecisionCarouselStyles();
  const { colors } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  const screenWidth = Dimensions.get("window").width;
  const CARD_WIDTH = 258;
  const CARD_GAP = spacing.md;
  const SIDE_PADDING = (screenWidth - CARD_WIDTH) / 2;

  const cardColors = useMemo(() => [colors.coral, colors.butter, colors.mint, colors.blueSoft, colors.peach, colors.purpleSoft], [colors]);

  return (
    <View style={carouselStyles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingHorizontal: SIDE_PADDING,
          gap: CARD_GAP,
          paddingVertical: spacing.md,
        }}
        style={{ marginHorizontal: -spacing.xl }}
      >
        {options.map((option, index) => {
          const isSelected = activeId === option.id;
          const isDimmed = !viewOnly && activeId && !isSelected;

          return (
            <Pressable
              key={option.id}
              onPress={() => !viewOnly && onOptionSelect?.(option.id)}
              onLongPress={() => {
                if (option.title || option.label) {
                  setExpandedIndex(index);
                }
              }}
              style={[
                carouselStyles.card,
                { backgroundColor: cardColors[index % cardColors.length] },
                isSelected && !viewOnly && carouselStyles.cardSelected,
                isDimmed && carouselStyles.cardDimmed,
                option.imageUrl ? { justifyContent: "space-between" } : null,
              ]}
            >
              {option.imageUrl ? (
                <View style={[carouselStyles.imageArea, !option.title ? { flex: 1, height: undefined } : null]}>
                  <Image source={{ uri: option.imageUrl }} style={carouselStyles.image} />
                </View>
              ) : null}
              {!option.imageUrl || option.title ? (
                <View style={!option.imageUrl ? { flex: 1, justifyContent: "center" } : undefined}>
                  <Text style={[
                    carouselStyles.optionTitle, 
                    { fontSize: (option.title || option.label).length > 20 ? 18 : 22 },
                    { color: isColorDark(cardColors[index % cardColors.length]) ? "#FFFFFF" : colors.ink }
                  ]} numberOfLines={3}>
                    {option.title || (!option.imageUrl ? option.label : "")}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <ExpandedCardModal 
        option={expandedIndex !== null ? options[expandedIndex] : null}
        color={expandedIndex !== null ? cardColors[expandedIndex % cardColors.length] : colors.surface}
        visible={expandedIndex !== null}
        onClose={() => setExpandedIndex(null)}
      />
    </View>
  );
}

export function ExpandedCardModal({ option, color, visible, onClose }: { option: any, color: string, visible: boolean, onClose: () => void }) {
  const { colors } = useTheme();
  if (!option) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(24, 18, 15, 0.8)", padding: spacing.xl, justifyContent: "center", alignItems: "center" }} onPress={onClose}>
        <Pressable 
          style={option.imageUrl ? {
            width: "100%",
            height: "80%",
          } : { 
            backgroundColor: color, 
            borderColor: colors.ink,
            borderWidth: 4,
            borderRadius: 34,
            padding: spacing.xl,
            width: "100%",
            maxHeight: "80%",
            shadowColor: colors.ink,
            shadowOffset: { width: 8, height: 10 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 10,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView bounces={false} contentContainerStyle={{ gap: spacing.md, flexGrow: 1, ...(option.imageUrl ? {} : { paddingVertical: spacing.md }) }} showsVerticalScrollIndicator={false}>
            {option.imageUrl ? (
              <View style={{ width: "100%", flex: 1, minHeight: 200, borderRadius: 24, overflow: "hidden" }}>
                <Image source={{ uri: option.imageUrl }} style={{ width: "100%", height: "100%" }} />
              </View>
            ) : null}
            {!option.imageUrl || option.title ? (
              <Text style={{
                color: option.imageUrl ? "#FFFFFF" : (isColorDark(color) ? "#FFFFFF" : colors.ink),
                fontSize: 32,
                fontWeight: "900",
                textAlign: "center",
                ...(option.imageUrl ? { padding: spacing.md } : {})
              }}>
                {option.title || (!option.imageUrl ? option.label : "")}
              </Text>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
