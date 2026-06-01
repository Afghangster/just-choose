import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Alert, Animated, Dimensions, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, PanResponder, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Edge } from "react-native-safe-area-context";
import { Bookmark, CheckCircle2, ChevronRight, Clock, Copy, Home, LogOut, Mail, Palette, Plus, RefreshCw, Shield, SlidersHorizontal, Share2, ShieldCheck, Sparkles, UserRound, X, MoreHorizontal, Trash2 } from "lucide-react-native";

import {
  AnimatedResultCard,
  Avatar,
  Button,
  Card,
  DecisionCarousel,
  DecisionGrid,
  EmptyState,
  LargeTextField,
  OptionPreview,
  Pill,
  QuestionArea,
  Screen,
  Segment,
  TextField,
  useStyles,
} from "../components/ui";
import { chooseDecisionImage, uploadDecisionImage, uploadAvatarImage } from "../services/imageService";
import {
  completeOAuthSignIn,
  resendSignupConfirmation,
  startAppleOAuthSignIn,
  signInWithAppleIdentityToken,
  signInWithEmail,
  signUpWithEmail,
  startGoogleSignIn,
  upsertProfile,
} from "../services/supabaseRepository";
import { useAppStore } from "../store/appStore";
import { useTheme, spacing, typography, palettes } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import type { Connection, Decision, Gender, ResponseType } from "../types/domain";
import { createDecisionSchema } from "../validation/decisionSchemas";

type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

const brandIcon = require("../../assets/JustChoose.png");
const splashIcon = require("../../assets/SplashScreen.png");

const AppleIcon = ({ size, color }: { size: number, color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 384 512" fill={color}>
    <Path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </Svg>
);

const GoogleIcon = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>
);
const nativeHeaderScreenEdges: Edge[] = ["right", "bottom", "left"];

WebBrowser.maybeCompleteAuthSession();

function makeAuthRedirectUri() {
  return Linking.createURL("auth/callback");
}

function getErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const rawMessage = typeof maybeError?.message === "string" ? maybeError.message : "";
  const code = typeof maybeError?.code === "string" ? maybeError.code : "";
  if (code === "over_email_send_rate_limit" || rawMessage.toLowerCase().includes("email rate limit")) {
    return "Too many signup emails were sent. Please wait a minute, then try again.";
  }
  if (rawMessage.toLowerCase().includes("sms") || rawMessage.toLowerCase().includes("phone")) {
    return rawMessage;
  }
  if (rawMessage.toLowerCase().includes("network request failed")) {
    return "Could not reach the server. Check your connection and Supabase URL.";
  }
  return rawMessage || fallback;
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function normalizeInviteCodeInput(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function formatInviteCode(value: string) {
  const normalized = normalizeInviteCodeInput(value);
  return normalized.match(/.{1,4}/g)?.join("-") ?? "";
}

function makeInviteLink(inviteCode: string) {
  return `justchoose://invite/${normalizeInviteCodeInput(inviteCode)}`;
}

function makeInviteMessage(inviteCode: string) {
  const formattedCode = formatInviteCode(inviteCode);
  return [
    "Join me on Just Choose.",
    "",
    `Invite code: ${formattedCode}`,
    `Open: ${makeInviteLink(inviteCode)}`,
    "",
    "This one-time code expires soon.",
  ].join("\n");
}

export function SplashScreen({ navigation }: Props<"Splash">) {
  const hydrateFromRemote = useAppStore((state) => state.hydrateFromRemote);
  const { colors } = useTheme();

  const translateY = useMemo(() => new Animated.Value(20), []);
  const opacity = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => {
    const timer = setTimeout(() => {
      hydrateFromRemote()
        .then((remoteState) => {
          if (!remoteState.profile) {
            navigation.replace("Auth");
          } else {
            navigation.replace("Home");
          }
        })
        .catch(() => navigation.replace("Auth"));
    }, 1200); // Wait for animation + extra breathing room

    return () => clearTimeout(timer);
  }, [hydrateFromRemote, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <Animated.Image
        source={splashIcon}
        style={{ flex: 1, width: "100%", height: "100%", resizeMode: "cover", opacity }}
      />
    </View>
  );
}

export function AuthScreen({ navigation }: Props<"Auth">) {
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const hydrateFromRemote = useAppStore((state) => state.hydrateFromRemote);
  const pendingInviteCode = useAppStore((state) => state.pendingInviteCode);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const uiStyles = useStyles();

  async function continueAfterAuth(userId: string) {
    setAuthUser(userId);
    const remoteState = await hydrateFromRemote();
    if (!remoteState.profile) {
      navigation.navigate("CreateProfile");
    } else if (pendingInviteCode && !remoteState.connectedProfile) {
      navigation.replace("JoinConnection", { inviteCode: pendingInviteCode });
    } else {
      navigation.replace("Home");
    }
  }

  async function submitEmail() {
    setBusy(true);
    try {
      const result =
        mode === "signup"
          ? await signUpWithEmail(email.trim(), password)
          : await signInWithEmail(email.trim(), password);
      if ("needsEmailConfirmation" in result && result.needsEmailConfirmation) {
        navigation.navigate("CheckEmail", { email: result.email });
        return;
      }
      if (!result.userId) {
        throw new Error("Sign-in did not return a user. Please try again.");
      }
      await continueAfterAuth(result.userId);
    } catch (error) {
      Alert.alert("Sign-in issue", getErrorMessage(error, "Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function submitApple() {
    setBusy(true);
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        throw new Error("Apple Sign In is not available on this device.");
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }
      const result = await signInWithAppleIdentityToken(credential.identityToken);
      await continueAfterAuth(result.userId);
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple sign-in issue", getErrorMessage(error, "Try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitAppleOAuth() {
    const redirectTo = makeAuthRedirectUri();
    setBusy(true);
    try {
      const { url } = await startAppleOAuthSignIn(redirectTo);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
      if (result.type !== "success") {
        return;
      }
      const authResult = await completeOAuthSignIn(result.url);
      await continueAfterAuth(authResult.userId);
    } catch (error) {
      Alert.alert("Apple sign-in issue", getErrorMessage(error, "Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function submitGoogle() {
    const redirectTo = makeAuthRedirectUri();
    setBusy(true);
    try {
      const { url } = await startGoogleSignIn(redirectTo);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
      if (result.type !== "success") {
        return;
      }
      const authResult = await completeOAuthSignIn(result.url);
      await continueAfterAuth(authResult.userId);
    } catch (error) {
      Alert.alert("Google sign-in issue", getErrorMessage(error, "Try again."));
    } finally {
      setBusy(false);
    }
  }

  const socialButtons = (
    <View style={{ gap: spacing.sm }}>
      {Platform.OS === "ios" ? (
        <Button
          label="Continue with Apple"
          variant="secondary"
          icon={<AppleIcon size={18} color={colors.ink} />}
          disabled={busy}
          onPress={submitApple}
        />
      ) : null}
      {Platform.OS === "android" || Platform.OS === "ios" ? (
        <Button
          label="Continue with Google"
          variant="secondary"
          icon={<GoogleIcon size={18} />}
          disabled={busy}
          onPress={submitGoogle}
        />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <View style={{ alignItems: "center", marginBottom: -24, marginTop: spacing.xl, zIndex: 10 }}>
        <Image source={brandIcon} style={{ height: 96, width: 96, resizeMode: "contain", borderRadius: 16 }} />
      </View>
      <Card
        style={{
          borderWidth: 2,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
          borderRadius: 24,
          padding: 20,
          width: "92%",
          maxWidth: 400,
          alignSelf: "center",
        }}
      >
        <View style={uiStyles.brandRow}>
          <View style={uiStyles.brandText}>
            <Text style={[typography.h2, { color: colors.ink }]}>Someone's got to choose.</Text>
            <Text style={uiStyles.small}>Create an account, pair up, then send your first choice.</Text>
          </View>
        </View>
        {socialButtons}
        {!showEmailForm ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowEmailForm(true)}
            style={({ pressed }) => [{ alignItems: "center", paddingVertical: spacing.sm }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700" }}>Use email instead →</Text>
          </Pressable>
        ) : (
          <>
            <View style={uiStyles.dividerRow}>
              <View style={uiStyles.dividerLine} />
              <Text style={uiStyles.small}>or</Text>
              <View style={uiStyles.dividerLine} />
            </View>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Minimum 6 characters"
            />
            <Button
              label={busy ? (mode === "signup" ? "Creating..." : "Signing in...") : mode === "signup" ? "Sign up with email" : "Sign in"}
              icon={<Mail size={18} color="#fff" />}
              disabled={busy || !email.trim() || password.length < 6}
              onPress={submitEmail}
            />
          </>
        )}
      </Card>
      
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => setMode(mode === "signup" ? "signin" : "signup")}
        style={({ pressed }) => [{ alignSelf: "center", marginTop: spacing.md }, pressed && { opacity: 0.7 }]}
      >
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <Text style={{ color: colors.ink, fontWeight: "900" }}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

export function CheckEmailScreen({ navigation, route }: Props<"CheckEmail">) {
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const uiStyles = useStyles();
  const email = route.params.email;

  async function resend() {
    setBusy(true);
    try {
      await resendSignupConfirmation(email);
      Alert.alert("Email sent", "Check your inbox for a fresh confirmation link.");
    } catch (error) {
      Alert.alert("Email issue", getErrorMessage(error, "Unable to resend confirmation email."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Check your email" subtitle="Your account is created. Confirm it once, then sign in.">
      <Card
        style={{
          borderWidth: 2,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
          borderRadius: 24,
          padding: 20,
          width: "92%",
          maxWidth: 400,
          alignSelf: "center",
        }}
      >
        <View style={uiStyles.brandRow}>
          <Image source={brandIcon} style={uiStyles.brandIcon} />
          <View style={uiStyles.brandText}>
            <Text style={[typography.h2, { color: colors.ink }]}>Almost there</Text>
            <Text style={uiStyles.small}>
              We sent a confirmation link to {email}. Open it, then come back and sign in.
            </Text>
          </View>
        </View>
        <Button label="I confirmed it" onPress={() => navigation.replace("Auth")} />
        <Button
          label={busy ? "Sending..." : "Resend email"}
          variant="secondary"
          disabled={busy}
          onPress={resend}
        />
      </Card>
    </Screen>
  );
}

export function CreateProfileScreen({ navigation }: Props<"CreateProfile">) {
  const createProfile = useAppStore((state) => state.createProfile);
  const applyRemoteState = useAppStore((state) => state.applyRemoteState);
  const pendingInviteCode = useAppStore((state) => state.pendingInviteCode);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("prefer_not_to_say");
  const [busy, setBusy] = useState(false);
  const parsedAge = Number(age);
  const ageIsValid = Number.isInteger(parsedAge) && parsedAge >= 13 && parsedAge <= 120;

  async function submit() {
    if (!ageIsValid) {
      Alert.alert("Age needed", "Enter an age between 13 and 120.");
      return;
    }
    setBusy(true);
    try {
      const profile = createProfile({ displayName, age: parsedAge, gender });
      const remoteState = await upsertProfile(profile);
      applyRemoteState(remoteState);
      if (pendingInviteCode && !remoteState.connectedProfile) {
        navigation.replace("JoinConnection", { inviteCode: pendingInviteCode });
      } else {
        navigation.replace("Home");
      }
    } catch (error) {
      Alert.alert("Profile issue", getErrorMessage(error, "Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="What's your name?" subtitle="Three tiny details, then you are in.">
      <Card
        style={{
          borderWidth: 2,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
          borderRadius: 24,
          padding: 20,
          width: "92%",
          maxWidth: 400,
          alignSelf: "center",
        }}
      >
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Mia"
        />
        <TextField
          label="Age"
          value={age}
          onChangeText={(value) => setAge(value.replace(/[^0-9]/g, "").slice(0, 3))}
          keyboardType="numeric"
          placeholder="28"
        />
        <Segment
          label="Gender"
          value={gender}
          options={[
            { value: "woman", label: "Female" },
            { value: "man", label: "Male" },
            { value: "prefer_not_to_say", label: "Prefer not" },
          ]}
          onChange={setGender}
        />
        <Button label="Continue" disabled={busy || !displayName.trim() || !ageIsValid} onPress={submit} />
      </Card>
    </Screen>
  );
}

export function ConnectionInviteScreen({ navigation }: Props<"ConnectionInvite">) {
  const connection = useAppStore((state) => state.connection);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const createRemoteConnectionInvite = useAppStore((state) => state.createRemoteConnectionInvite);
  const refreshRemoteState = useAppStore((state) => state.refreshRemoteState);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const { colors } = useTheme();
  const uiStyles = useStyles();
  const inviteCode = connection?.inviteCode ?? "";
  const inviteMessage = inviteCode ? makeInviteMessage(inviteCode) : "";

  async function copyInvite() {
    if (!inviteMessage) {
      return;
    }
    await Clipboard.setStringAsync(inviteMessage);
    Alert.alert("Invite copied", "The code and app link are ready to paste.");
  }

  async function shareInvite() {
    if (!inviteMessage) {
      return;
    }
    await Share.share({ message: inviteMessage });
  }

  return (
    <Screen
      title="Invite someone"
      subtitle={connectedProfile ? "You are connected." : "One code. One connection. No awkward mystery links."}
      onRefresh={() => refreshRemoteState().catch(() => undefined)}
      refreshing={remoteStatus === "loading"}
    >
      <Card>
        <View style={uiStyles.brandRow}>
          <Image source={brandIcon} style={uiStyles.brandIcon} />
          <View style={uiStyles.brandText}>
            <Text style={[typography.h2, { color: colors.ink }]}>
              {connectedProfile ? `Connected with ${connectedProfile.displayName}` : "Invite code"}
            </Text>
            <Text style={uiStyles.small}>
              {connectedProfile
                ? "You can now send private choices to each other."
                : "They preview your name before accepting."}
            </Text>
          </View>
          {connectedProfile ? <CheckCircle2 size={24} color={colors.green} /> : null}
        </View>
        {!connectedProfile ? (
          <>
            <Text selectable style={[typography.title, { color: colors.teal }]}>
              {inviteCode ? formatInviteCode(inviteCode) : "READY?"}
            </Text>
            <Text style={uiStyles.small}>
              {inviteCode
                ? "This one-time code expires in one hour. Generate a new code if it expires or was shared with the wrong person."
                : "Tap New code when you are ready to invite someone."}
            </Text>
            {connection?.inviteExpiresAt ? (
              <Text style={uiStyles.small}>
                Expires at {new Date(connection.inviteExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
              </Text>
            ) : null}
            <View style={uiStyles.inlineActions}>
              <Button
                label="Copy"
                variant="secondary"
                icon={<Copy size={18} color={colors.ink} />}
                disabled={!inviteCode || remoteStatus === "loading"}
                onPress={copyInvite}
              />
              <Button
                label="Share"
                variant="secondary"
                icon={<Share2 size={18} color={colors.ink} />}
                disabled={!inviteCode || remoteStatus === "loading"}
                onPress={shareInvite}
              />
            </View>
            <Button
              label="New code"
              variant="ghost"
              icon={<RefreshCw size={18} color={colors.ink} />}
              disabled={remoteStatus === "loading"}
              onPress={() => createRemoteConnectionInvite().catch(() => undefined)}
            />
          </>
        ) : null}
        {remoteStatus === "loading" ? <Text style={uiStyles.small}>{inviteCode ? "Refreshing..." : "Creating invite..."}</Text> : null}
        {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}
      </Card>
      {connectedProfile ? (
        <Button label="Let's choose" onPress={() => navigation.replace("Home")} />
      ) : null}
      {!connectedProfile ? (
        <Button label="Join with an invite" variant="secondary" onPress={() => navigation.navigate("JoinConnection")} />
      ) : null}
    </Screen>
  );
}

export function JoinConnectionScreen({ navigation, route }: Props<"JoinConnection">) {
  const profile = useAppStore((state) => state.profile);
  const previewRemoteConnectionInvite = useAppStore((state) => state.previewRemoteConnectionInvite);
  const acceptRemoteConnectionInvite = useAppStore((state) => state.acceptRemoteConnectionInvite);
  const setPendingInviteCode = useAppStore((state) => state.setPendingInviteCode);
  const connectionPreview = useAppStore((state) => state.connectionPreview);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const [inviteCode, setInviteCode] = useState(() => normalizeInviteCodeInput(route.params?.inviteCode ?? ""));
  const normalizedInviteCode = normalizeInviteCodeInput(inviteCode);
  const previewMatchesCode = connectionPreview?.code === normalizedInviteCode;
  const uiStyles = useStyles();

  useEffect(() => {
    if (normalizedInviteCode) {
      setPendingInviteCode(normalizedInviteCode);
    }
  }, [normalizedInviteCode, setPendingInviteCode]);

  if (!profile) {
    return (
      <Screen title="Sign in first" subtitle="Create your profile before accepting a connection invite.">
        <Button label="Sign in" onPress={() => navigation.replace("Auth")} />
      </Screen>
    );
  }

  return (
    <Screen title="Accept connection" subtitle="Enter their code, then approve the connection.">
      <Card>
        <TextField
          label="Invite code"
          value={inviteCode}
          onChangeText={(value) => setInviteCode(normalizeInviteCodeInput(value))}
          placeholder="ABCD-EFGH-IJKL"
        />
        <Text style={uiStyles.small}>
          Connections let both of you send and answer private choices. Only accept if you know and trust the person who shared this code.
        </Text>
        {previewMatchesCode ? (
          <View style={uiStyles.previewPanel}>
            <Text style={typography.h2}>Connect with {connectionPreview.inviterDisplayName}?</Text>
            <Text style={uiStyles.small}>
              This invite expires at {new Date(connectionPreview.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
            </Text>
          </View>
        ) : null}
        {remoteStatus === "loading" ? <Text style={uiStyles.small}>Checking invite...</Text> : null}
        {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}
        {previewMatchesCode ? (
          <Button
            label="Accept connection"
            disabled={remoteStatus === "loading"}
            onPress={async () => {
              try {
                const remoteState = await acceptRemoteConnectionInvite(inviteCode);
                Alert.alert(
                  "Request sent",
                  `${connectionPreview.inviterDisplayName} needs to approve the connection before choices can be shared.`,
                );
                navigation.replace("Home");
              } catch {
                // The store exposes the remote error in this screen.
              }
            }}
          />
        ) : (
          <Button
            label="Preview connection"
            disabled={!normalizedInviteCode || remoteStatus === "loading"}
            onPress={() => previewRemoteConnectionInvite(inviteCode).catch(() => undefined)}
          />
        )}
      </Card>
    </Screen>
  );
}

export function ConnectionRequestScreen({ navigation, route }: Props<"ConnectionRequest">) {
  const pendingConnectionRequests = useAppStore((state) => state.pendingConnectionRequests);
  const approveConnectionRequest = useAppStore((state) => state.approveConnectionRequest);
  const rejectConnectionRequest = useAppStore((state) => state.rejectConnectionRequest);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const request = pendingConnectionRequests.find((item) => item.requesterId === route.params.requesterId);
  const uiStyles = useStyles();

  if (!request) {
    return (
      <Screen title="Request handled" subtitle="There is no pending request for this person.">
        <Button label="Back home" onPress={() => navigation.replace("Home")} />
      </Screen>
    );
  }

  return (
    <Screen title="Connection request" subtitle={`${request.requesterDisplayName} is trying to connect to you.`}>
      <Card>
        <Text style={typography.h2}>{request.requesterDisplayName}</Text>
        <Text style={uiStyles.small}>
          Only accept if you know this person. Once accepted, you can send private choices to each other.
        </Text>
        {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}
        <Button
          label={remoteStatus === "loading" ? "Accepting..." : "Accept"}
          disabled={remoteStatus === "loading"}
          onPress={async () => {
            try {
              await approveConnectionRequest(request.requesterId);
              navigation.replace("Home");
            } catch {
              // The store exposes the remote error in this screen.
            }
          }}
        />
        <Button
          label="Reject"
          variant="secondary"
          disabled={remoteStatus === "loading"}
          onPress={async () => {
            try {
              await rejectConnectionRequest(request.requesterId);
              navigation.replace("Home");
            } catch {
              // The store exposes the remote error in this screen.
            }
          }}
        />
      </Card>
    </Screen>
  );
}

export function HomeScreen({ navigation }: Props<"Home">) {
  const profile = useAppStore((state) => state.profile);
  const connection = useAppStore((state) => state.connection);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const pendingConnectionRequests = useAppStore((state) => state.pendingConnectionRequests);
  const decisions = useAppStore((state) => state.decisions);
  const refreshRemoteState = useAppStore((state) => state.refreshRemoteState);
  const registerCurrentDeviceForPush = useAppStore((state) => state.registerCurrentDeviceForPush);
  const signOut = useAppStore((state) => state.signOut);
  const deleteRemoteDecision = useAppStore((state) => state.deleteRemoteDecision);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const needsYourPick = decisions.filter((decision) => isOpenDecision(decision) && decision.assignedTo === profile?.id);
  const waitingOnThem = decisions.filter((decision) => isOpenDecision(decision) && decision.createdBy === profile?.id && decision.assignedTo !== profile?.id);
  const latestAnswer = decisions
    .filter((decision) => getDecisionStatus(decision) === "answered")
    .sort((a, b) => getDecisionTime(b) - getDecisionTime(a))[0];
  const { colors } = useTheme();
  const uiStyles = useStyles();
  const activePickCount = needsYourPick.length;

  useEffect(() => {
    if (profile && connection && connectedProfile) {
      registerCurrentDeviceForPush().catch(() => undefined);
    }
  }, [connection, connectedProfile, profile, registerCurrentDeviceForPush]);

  useEffect(() => {
    const request = pendingConnectionRequests[0];
    if (request && !connectedProfile) {
      navigation.navigate("ConnectionRequest", { requesterId: request.requesterId });
    }
  }, [connectedProfile, navigation, pendingConnectionRequests]);

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader title="Just Choose" />
        <Button label="Sign in" onPress={() => navigation.replace("Auth")} />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={() => refreshRemoteState().catch(() => undefined)}
      refreshing={remoteStatus === "loading"}
      footer={<FloatingTabBar active="home" navigation={navigation} />}
    >
      <ScreenHeader title={`HI ${profile.displayName.toUpperCase()}`} />
      <Text style={[uiStyles.subtitle, { alignSelf: "flex-start", textAlign: "left" }]}>
        You've got {activePickCount} {activePickCount === 1 ? "pick" : "picks"} to make
      </Text>
      {connection ? null : (
        <Card>
          <Text style={[typography.h2, { color: colors.ink }]}>No connection yet</Text>
          <Text style={uiStyles.small}>
            You can draft a question now. When you tap submit, Just Choose will ask you to create or join a connection first.
          </Text>
        </Card>
      )}
      {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}

      <SectionHeader title="Needs your pick" count={needsYourPick.length} />
      {needsYourPick.length === 0 ? (
        <EmptyState title="Nothing needs you" body="When someone sends you a choice, it will land here first." />
      ) : (
        needsYourPick.map((decision) => (
          <HomePickCard
            key={decision.id}
            decision={decision}
            fromName={connectedProfile?.displayName ?? "Them"}
            onPress={() => navigation.navigate("AnswerDecision", { decisionId: decision.id })}
          />
        ))
      )}

      <SectionHeader title="Waiting on them" count={waitingOnThem.length} />
      {waitingOnThem.length === 0 ? (
        <EmptyState title="No waiting picks" body="Questions you send will wait here until they choose." />
      ) : (
        waitingOnThem.map((decision) => (
          <HomeWaitingCard
            key={decision.id}
            decision={decision}
            assigneeName={connectedProfile?.displayName ?? "them"}
            onPress={() => navigation.navigate("DecisionDetail", { decisionId: decision.id })}
            onCancel={async () => {
              try {
                await deleteRemoteDecision(decision.id);
              } catch (error) {
                Alert.alert("Error", error instanceof Error ? error.message : "Unable to cancel choice.");
              }
            }}
          />
        ))
      )}

      {latestAnswer ? (
        <>
          <SectionHeader title="Latest answer" count={1} />
          <LatestAnswerCard
            decision={latestAnswer}
            profileId={profile.id}
            connectedProfileName={connectedProfile?.displayName ?? "They"}
            onPress={() => navigation.navigate("DecisionResult", { decisionId: latestAnswer.id })}
            onHistoryPress={() => navigation.navigate("History")}
          />
        </>
      ) : null}
    </Screen>
  );
}

type HistoryFilter = "All" | "Mine" | "Theirs" | "Cancelled";
type ExtendedDecisionStatus = Decision["status"] | "cancelled" | "expired";

function getDecisionStatus(decision: Decision): ExtendedDecisionStatus {
  return decision.status as ExtendedDecisionStatus;
}

function isOpenDecision(decision: Decision) {
  return getDecisionStatus(decision) === "pending";
}

function isHistoryDecision(decision: Decision) {
  const status = getDecisionStatus(decision);
  return status === "answered" || status === "cancelled" || status === "expired";
}

function isCancelledDecision(decision: Decision) {
  const status = getDecisionStatus(decision);
  return status === "cancelled" || status === "expired";
}

function getSelectedOption(decision: Decision) {
  return decision.response?.selectedOptionId
    ? decision.options.find((option) => option.id === decision.response?.selectedOptionId)
    : null;
}

function getDecisionTime(decision: Decision) {
  return new Date(decision.answeredAt ?? decision.updatedAt ?? decision.createdAt).getTime();
}

function HomePickCard({
  decision,
  fromName,
  onPress,
}: {
  decision: Decision;
  fromName: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const uiStyles = useStyles();

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
            <Pill tone="coral">YOUR TURN</Pill>
            <ChevronRight size={24} color={colors.ink} strokeWidth={3} />
          </View>
          <Text style={[typography.h2, { color: colors.ink }]}>{decision.title}</Text>
          <Text style={uiStyles.small}>From {fromName} · {decision.options.length} options</Text>
          <View style={{ alignItems: "flex-start" }}>
            <ActionPillButton label="Choose" tone="coral" onPress={onPress} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function HomeWaitingCard({
  decision,
  assigneeName,
  onPress,
  onCancel,
}: {
  decision: Decision;
  assigneeName: string;
  onPress: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const uiStyles = useStyles();
  const waitingLabel = `WAITING FOR ${assigneeName.toUpperCase()}`;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ gap: spacing.md }}>
          <Pill tone="amber">{waitingLabel}</Pill>
          <Text style={[typography.h2, { color: colors.ink }]}>{decision.title}</Text>
          <Text style={uiStyles.small}>Sent {timeAgo(decision.createdAt)} · {decision.options.length} options</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <ActionPillButton 
              label="Cancel" 
              onPress={() => setShowCancelConfirm(true)} 
            />
          </View>
        </View>
      </Card>
      <CustomAlert 
        visible={showCancelConfirm}
        title="Cancel Pick?"
        message="Are you sure you want to cancel this pick? It will be removed for both of you."
        cancelText="Keep it"
        confirmText="Cancel pick"
        onCancel={() => setShowCancelConfirm(false)}
        onDelete={() => {
          setShowCancelConfirm(false);
          onCancel();
        }}
      />
    </Pressable>
  );
}

function LatestAnswerCard({
  decision,
  profileId,
  connectedProfileName,
  onPress,
  onHistoryPress,
}: {
  decision: Decision;
  profileId: string;
  connectedProfileName: string;
  onPress: () => void;
  onHistoryPress: () => void;
}) {
  const selected = getSelectedOption(decision);
  const responderName = decision.response?.responderId === profileId ? "You" : connectedProfileName;
  const uiStyles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.ink,
          borderRadius: 24,
          borderWidth: 2,
          gap: spacing.sm,
          padding: spacing.lg,
        }}
      >
        <Pill tone="green">ANSWERED</Pill>
        <Text style={[typography.h2, { color: colors.ink, fontSize: 18, lineHeight: 23 }]}>
          {responderName} chose {selected?.title ?? "an answer"}
        </Text>
        <Text style={uiStyles.small} numberOfLines={1}>{decision.title}</Text>
        <Pressable onPress={onHistoryPress} hitSlop={12}>
          <Text style={{ color: colors.coral, fontSize: 14, fontWeight: "900" }}>View history →</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function ActionPillButton({
  label,
  onPress,
  tone = "neutral",
}: {
  label: string;
  onPress: () => void;
  tone?: "neutral" | "coral";
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: tone === "coral" ? colors.coral : colors.surface,
          borderColor: colors.ink,
          borderRadius: 999,
          borderWidth: 2,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={{ color: tone === "coral" ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CustomAlert({ visible, title, message, onCancel, onDelete, confirmText = "Delete", cancelText = "Cancel" }: { visible: boolean, title: string, message: string, onCancel: () => void, onDelete: () => void, confirmText?: string, cancelText?: string }) {
  const { colors } = useTheme();
  
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ 
          backgroundColor: colors.background, 
          borderRadius: 28, 
          padding: 24, 
          width: '100%',
          maxWidth: 340,
          borderWidth: 2,
          borderColor: colors.border,
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 10
        }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink, marginBottom: 8, textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.muted, marginBottom: 24, textAlign: 'center', lineHeight: 22 }}>{message}</Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable 
              onPress={onCancel} 
              style={{ flex: 1, backgroundColor: colors.surfaceMuted, paddingVertical: 14, borderRadius: 999, alignItems: 'center' }}
            >
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>{cancelText}</Text>
            </Pressable>
            
            <Pressable 
              onPress={() => {
                onCancel();
                setTimeout(onDelete, 100);
              }} 
              style={{ flex: 1, backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 999, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function HistoryScreen({ navigation }: Props<"History">) {
  const profile = useAppStore((state) => state.profile);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const decisions = useAppStore((state) => state.decisions);
  const refreshRemoteState = useAppStore((state) => state.refreshRemoteState);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("All");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const uiStyles = useStyles();
  const histStyles = useHistoryStyles();
  const { colors } = useTheme();

  let visible = decisions.filter((decision) => isHistoryDecision(decision) && !dismissed.has(decision.id));

  if (activeFilter === "Mine") {
    visible = visible.filter((decision) => decision.response?.responderId === profile?.id);
  } else if (activeFilter === "Theirs") {
    visible = visible.filter((decision) => decision.response?.responderId && decision.response.responderId !== profile?.id);
  } else if (activeFilter === "Cancelled") {
    visible = visible.filter(isCancelledDecision);
  }

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  function activityContent(decision: Decision): { text: React.ReactNode; statusPill: React.ReactNode; selectedTitle: string } {
    const status = getDecisionStatus(decision);
    const connectedProfileName = connectedProfile?.displayName ?? "Bob";
    const selectedOption = getSelectedOption(decision);
    const selectedTitle = selectedOption?.title ?? selectedOption?.label ?? "an answer";

    let text: React.ReactNode;
    let statusPill: React.ReactNode;

    if (status === "answered") {
      const responderName = decision.response?.responderId === profile?.id ? "You" : connectedProfileName;
      statusPill = <Pill tone="green">Answered</Pill>;
      text = (
        <Text style={histStyles.activityText}>
          <Text style={histStyles.nameHighlight}>{responderName}</Text> chose {selectedTitle}
        </Text>
      );
    } else {
      const label = status === "expired" ? "Expired" : "Cancelled";
      statusPill = <Pill tone="amber">{label}</Pill>;
      text = (
        <Text style={histStyles.activityText}>
          <Text style={histStyles.nameHighlight}>You</Text> {status === "expired" ? "let expire" : "cancelled"} {decision.title}
        </Text>
      );
    }

    return { text, statusPill, selectedTitle };
  }

  const thumbnails = (decision: Decision) => {
    const images = decision.options.filter((o) => o.imageUrl).slice(0, 3);
    if (images.length === 0) return null;
    return (
      <View style={histStyles.thumbContainer}>
        <View style={histStyles.thumbRow}>
          {images.map((o) => (
            <Image key={o.id} source={{ uri: o.imageUrl! }} style={histStyles.thumb} />
          ))}
        </View>
        <Text style={histStyles.thumbLabel}>{decision.options.length} options</Text>
      </View>
    );
  };

  const filters: HistoryFilter[] = ["All", "Mine", "Theirs", "Cancelled"];

  return (
    <Screen
      onRefresh={() => refreshRemoteState().catch(() => undefined)}
      refreshing={remoteStatus === "loading"}
      footer={<FloatingTabBar active="history" navigation={navigation} />}
    >
      <ScreenHeader title="HISTORY" />
      <Text style={[uiStyles.small, { marginBottom: 4 }]}>Past choices and replies.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={histStyles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f}
            onPress={() => setActiveFilter(f)}
            style={[histStyles.filterChip, activeFilter === f && histStyles.filterChipActive]}
          >
            <Text style={[histStyles.filterText, activeFilter === f && histStyles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}

      {visible.length === 0 ? (
        <EmptyState title="Nothing finished yet" body="Completed, cancelled, and expired choices will appear here." />
      ) : (
        visible.map((decision) => {
          const { text, statusPill } = activityContent(decision);
          const status = getDecisionStatus(decision);

          return (
            <View key={decision.id} style={{ marginVertical: 4 }}>
              <Pressable
                onPress={() => {
                  if (status === "answered") {
                    navigation.navigate("DecisionResult", { decisionId: decision.id });
                  } else {
                    navigation.navigate("DecisionDetail", { decisionId: decision.id });
                  }
                }}
                style={({ pressed }) => [histStyles.receiptCard, pressed && { opacity: 0.85 }]}
              >
                <View style={histStyles.activityRow}>
                  {text}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={histStyles.timestamp}>{timeAgo(decision.updatedAt ?? decision.createdAt)}</Text>
                    <Pressable 
                      hitSlop={12} 
                      onPress={() => setItemToDelete(decision.id)}
                    >
                      <MoreHorizontal size={20} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>

                <Text style={histStyles.decisionTitle} numberOfLines={2}>
                  {decision.title}
                </Text>

                {thumbnails(decision)}

                <View style={{ marginTop: 8 }}>
                  {statusPill}
                </View>
              </Pressable>
            </View>
          );
        })
      )}

      {!profile ? <Button label="Sign in" onPress={() => navigation.replace("Auth")} /> : null}

      <CustomAlert 
        visible={itemToDelete !== null} 
        title="Delete Item" 
        message="Are you sure you want to remove this from your history?" 
        onCancel={() => setItemToDelete(null)}
        onDelete={() => {
          if (itemToDelete) {
            dismiss(itemToDelete);
            setItemToDelete(null);
          }
        }}
      />
    </Screen>
  );
}

export function SavedScreen({ navigation }: Props<"Saved">) {
  const profile = useAppStore((state) => state.profile);
  const decisions = useAppStore((state) => state.decisions);
  const savedDecisionIds = useAppStore((state) => state.savedDecisionIds);
  const savedDecisions = decisions.filter(d => savedDecisionIds.includes(d.id));

  return (
    <Screen footer={<FloatingTabBar active="saved" navigation={navigation} />}>
      <ScreenHeader title="Saved" />
      {savedDecisions.length === 0 ? (
        <EmptyState title="Nothing saved yet" body="Bookmark your favourite choices and they'll show up here." />
      ) : (
        savedDecisions.map((decision) => {
          const isAssignee = profile?.id === decision.assignedTo;
          return (
            <DecisionCard
              key={decision.id}
              decision={decision}
              onPress={() => {
                if (decision.status === "answered") {
                  navigation.navigate("DecisionResult", { decisionId: decision.id });
                } else if (isAssignee) {
                  navigation.navigate("AnswerDecision", { decisionId: decision.id });
                } else {
                  navigation.navigate("DecisionDetail", { decisionId: decision.id });
                }
              }}
            />
          );
        })
      )}
    </Screen>
  );
}

export function CreateDecisionScreen({ navigation }: Props<"CreateDecision">) {
  const profile = useAppStore((state) => state.profile);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const connection = useAppStore((state) => state.connection);
  const createRemoteDecision = useAppStore((state) => state.createRemoteDecision);
  const note = useAppStore((state) => state.draftNote);
  const setNote = useAppStore((state) => state.setDraftNote);
  const options = useAppStore((state) => state.draftOptions);
  const setOptions = useAppStore((state) => state.setDraftOptions);
  const clearDraft = useAppStore((state) => state.clearDraft);
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const uiStyles = useStyles();

  function updateOption(index: number, patch: Partial<(typeof options)[number]>) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    );
  }

  async function addImage(index: number) {
    const picked = await chooseDecisionImage();
    if (!picked) {
      return;
    }

    try {
      const uploaded = profile
        ? await uploadDecisionImage(profile.id, picked)
        : { imageUrl: picked, imagePath: null };
      updateOption(index, uploaded);
    } catch (error) {
      Alert.alert("Image upload issue", error instanceof Error ? error.message : "Try again.");
      updateOption(index, { imageUrl: picked, imagePath: null });
    }
  }

  async function submit() {
    const parsed = createDecisionSchema.safeParse({ note, options });
    if (!parsed.success) {
      Alert.alert("Add the basics", parsed.error.issues[0]?.message ?? "Check the options.");
      return;
    }

    if (!profile) {
      Alert.alert("Sign in first", "Create your profile before sending a choice.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => navigation.navigate("Auth") },
      ]);
      return;
    }

    if (!connection || !connectedProfile) {
      Alert.alert("Connection needed", "Set up a connection before submitting. Your draft will stay here while you do that.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Set up connection", onPress: () => navigation.navigate("ConnectionInvite") },
      ]);
      return;
    }

    setBusy(true);
    try {
      const decision = await createRemoteDecision({
        note: parsed.data.note,
        options: parsed.data.options.map((option, index) => ({
          label: String.fromCharCode(65 + index),
          title: option.title?.trim() || null,
          imageUrl: option.imageUrl ?? null,
          imagePath: option.imagePath ?? null,
        })),
      });
      clearDraft();
      navigation.replace("DecisionDetail", { decisionId: decision.id });
    } catch (error) {
      Alert.alert("Choice issue", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen safeAreaEdges={nativeHeaderScreenEdges}>
      <LargeTextField
        value={note}
        onChangeText={setNote}
        placeholder="Where should we eat tonight?"
      />

      <AttachmentCarousel
        options={options}
        onAddImage={addImage}
        onUpdateOption={updateOption}
        onRemoveOption={(index) => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        canRemove={options.length > 2}
        canAdd={options.length < 6}
        onAddOption={() => setOptions((current) => [...current, { title: "", imageUrl: null, imagePath: null }])}
      />

      <Button label={busy ? "LAUNCHING..." : "JUST CHOOSE"} disabled={busy} onPress={submit} />
    </Screen>
  );
}

export function DecisionDetailScreen({ route, navigation }: Props<"DecisionDetail">) {
  const decision = useDecision(route.params.decisionId);
  const profile = useAppStore((state) => state.profile);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const savedDecisionIds = useAppStore((state) => state.savedDecisionIds);
  const toggleSavedDecision = useAppStore((state) => state.toggleSavedDecision);
  const { colors } = useTheme();

  if (!decision) {
    return <MissingDecisionScreen navigation={navigation} />;
  }

  const isSaved = savedDecisionIds.includes(decision.id);

  const canAnswer = profile?.id === decision.assignedTo && decision.status === "pending";
  const isCreator = profile?.id === decision.createdBy;

  return (
    <Screen 
      footer={
        decision.status === "answered" ? (
          <Button label="Show the verdict" onPress={() => navigation.navigate("DecisionResult", { decisionId: decision.id })} />
        ) : canAnswer ? (
          <Button label="Just choose" onPress={() => navigation.navigate("AnswerDecision", { decisionId: decision.id })} />
        ) : isCreator ? (
          <Pill tone="amber" style={{ alignSelf: "center", marginVertical: 16 }}>
            Waiting for {connectedProfile?.displayName ?? "connection"}
          </Pill>
        ) : null
      }
    >
      <View style={{ alignItems: "flex-end", minHeight: 32 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? "Remove from saved" : "Save choice"}
          onPress={() => toggleSavedDecision(decision.id)}
          hitSlop={16}
          style={({ pressed }) => [pressed && { opacity: 0.75 }]}
        >
          <Bookmark size={30} color={isSaved ? colors.coral : colors.ink} fill={isSaved ? colors.coral : "transparent"} strokeWidth={3} />
        </Pressable>
      </View>
      <QuestionArea question={decision.note || decision.title} />
      {decision.options.length >= 5 ? (
        <DecisionCarousel options={decision.options} viewOnly={true} />
      ) : (
        <DecisionGrid options={decision.options} viewOnly={true} />
      )}
    </Screen>
  );
}

export function AnswerDecisionScreen({ route, navigation }: Props<"AnswerDecision">) {
  const decision = useDecision(route.params.decisionId);
  const answerRemoteDecision = useAppStore((state) => state.answerRemoteDecision);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const [comment, setComment] = useState("");
  const { colors } = useTheme();
  const uiStyles = useStyles();
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!decision) {
    return <MissingDecisionScreen navigation={navigation} />;
  }
  const currentDecision = decision;

  async function submit() {
    if (!activeId) return;
    const option = currentDecision.options.find(o => o.id === activeId);
    if (!option) return;
    await answerRemoteDecision(currentDecision.id, {
      responseType: "selected_option" as ResponseType,
      selectedOptionId: option.id,
      comment,
    });
    navigation.replace("DecisionResult", { decisionId: currentDecision.id });
  }

  return (
    <Screen 
      footer={
        <View style={{ gap: 16 }}>
          <TextField label="Comment" value={comment} onChangeText={setComment} multiline placeholder="Optional" />
          <Button
            label={remoteStatus === "loading" ? "SUBMITTING..." : "JUST CHOOSE"}
            onPress={submit}
            disabled={!activeId || remoteStatus === "loading"}
          />
        </View>
      }
    >
      <QuestionArea question={currentDecision.note || currentDecision.title || "JUST CHOOSE"} />
      {currentDecision.options.length >= 5 ? (
        <DecisionCarousel 
          options={currentDecision.options} 
          activeId={activeId} 
          onOptionSelect={setActiveId} 
        />
      ) : (
        <DecisionGrid 
          options={currentDecision.options} 
          activeId={activeId} 
          onOptionSelect={setActiveId} 
        />
      )}
    </Screen>
  );
}

export function DecisionResultScreen({ route, navigation }: Props<"DecisionResult">) {
  const decision = useDecision(route.params.decisionId);
  const uiStyles = useStyles();
  const { colors } = useTheme();
  const savedDecisionIds = useAppStore((state) => state.savedDecisionIds);
  const toggleSavedDecision = useAppStore((state) => state.toggleSavedDecision);

  const phrase = useMemo(() => {
    const phrases = [
      "Decision made.",
      "No take-backs.",
      "The app has spoken.",
      "Chosen. Move on.",
      "Trust the chaos.",
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }, []);

  if (!decision) {
    return <MissingDecisionScreen navigation={navigation} />;
  }

  const response = decision.response;
  const selected = decision.options.find((option) => option.id === response?.selectedOptionId);
  const isSaved = savedDecisionIds.includes(decision.id);

  return (
    <Screen 
      title="Result" 
      subtitle={response ? phrase : decision.title}
      headerRight={
        <Pressable onPress={() => toggleSavedDecision(decision.id)} hitSlop={16}>
          <Bookmark size={24} color={isSaved ? colors.coral : colors.ink} fill={isSaved ? colors.coral : "transparent"} strokeWidth={3} />
        </Pressable>
      }
    >
      {!response ? (
        <EmptyState title="No answer yet" body="The choice is still waiting." />
      ) : (
        <AnimatedResultCard>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", width: "100%", gap: spacing.xl }}>
            {selected ? (
              <>
                {selected.imageUrl ? <Image source={{ uri: selected.imageUrl }} style={{ width: 160, height: 160, borderRadius: 24, borderWidth: 4, borderColor: colors.ink }} /> : null}
                <Text style={{ fontSize: 44, fontWeight: "900", color: colors.ink, textAlign: "center", textTransform: "uppercase" }}>
                  {selected.title || selected.label}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 44, fontWeight: "900", color: colors.ink, textAlign: "center", textTransform: "uppercase" }}>
                Could not choose
              </Text>
            )}
            {response.comment ? <Text style={[typography.body, { color: colors.ink, textAlign: "center", fontStyle: "italic" }]}>"{response.comment}"</Text> : null}
          </View>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", fontWeight: "700", opacity: 0.7, marginTop: "auto", paddingTop: spacing.xl }}>Answered {new Date(response.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</Text>
        </AnimatedResultCard>
      )}
      <Button label="Back to chaos" onPress={() => navigation.navigate("Home")} />
    </Screen>
  );
}

export function SettingsScreen({ navigation }: Props<"Settings">) {
  const { colors, themeName } = useTheme();
  const connection = useAppStore((state) => state.connection);
  const signOut = useAppStore((state) => state.signOut);
  const formattedThemeName = themeName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  return (
    <Screen footer={<FloatingTabBar active="settings" navigation={navigation} />}>
      <ScreenHeader title="Settings" />
      <SettingsRow
        title="App Theme"
        subtitle={formattedThemeName}
        icon={<Palette size={24} color={colors.teal} strokeWidth={3} />}
        onPress={() => navigation.navigate("ThemeSelection")}
      />
      <SettingsRow
        title="Safety and privacy"
        subtitle="What Just Choose stores"
        icon={<ShieldCheck size={24} color={colors.teal} strokeWidth={3} />}
        onPress={() => navigation.navigate("SafetyPrivacy")}
      />
      <SettingsRow
        title="Manage connections"
        subtitle="Rename or stop your connections"
        icon={<UserRound size={24} color={colors.coral} strokeWidth={3} />}
        onPress={() => navigation.navigate("ManageConnections")}
      />
      <SettingsRow
        title="Log out"
        subtitle="Sign out of your account"
        icon={<LogOut size={24} color={colors.danger} strokeWidth={3} />}
        titleColor={colors.danger}
        onPress={() => {
          Alert.alert(
            "Log out?",
            "You'll need to sign in again to use Just Choose.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log out",
                style: "destructive",
                onPress: async () => {
                  try {
                    await signOut();
                    navigation.replace("Auth");
                  } catch (error) {
                    Alert.alert("Log out issue", error instanceof Error ? error.message : "Unable to log out.");
                  }
                },
              },
            ],
          );
        }}
      />
    </Screen>
  );
}

export function ThemeSelectionScreen({ navigation }: Props<"ThemeSelection">) {
  const { colors, themeName, setTheme } = useTheme();

  const getThemeSubtitle = (name: string) => {
    switch (name) {
      case "classic": return "Warm, high-contrast default";
      case "monochrome": return "Sleek, minimalist black and white";
      case "pinkBlossom": return "Soft, floral pastel pinks";
      case "softHorizon": return "Calm, airy blue and grey";
      case "pearGarden": return "Fresh botanical greens";
      case "lavenderHaze": return "Dreamy, muted purple";
      default: return "Beautiful custom theme";
    }
  };

  return (
    <Screen safeAreaEdges={nativeHeaderScreenEdges}>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}>
        {Object.entries(palettes).map(([name, palette]) => {
          const isActive = themeName === name;
          const formattedName = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

          return (
            <Pressable key={name} onPress={() => setTheme(name)}>
              <View style={{
                backgroundColor: isActive ? "#F0FAF4" : colors.surface,
                borderColor: isActive ? "#5FAE7A" : colors.ink,
                borderWidth: isActive ? 3 : 2,
                borderRadius: 24,
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                shadowColor: colors.ink,
                shadowOffset: { width: 0, height: isActive ? 6 : 4 },
                shadowOpacity: isActive ? 0.2 : 0.1,
                shadowRadius: isActive ? 8 : 4,
                elevation: isActive ? 6 : 3,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
                  <View style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: 16, 
                    backgroundColor: palette.background,
                    borderWidth: 2,
                    borderColor: palette.ink,
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 32, right: 0, backgroundColor: palette.teal }} />
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, backgroundColor: palette.coral, opacity: 0.8 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[typography.h2, { color: isActive ? "#20342A" : colors.ink }]}>{formattedName}</Text>
                    <Text style={[typography.small, { color: isActive ? "#5FAE7A" : colors.muted }]}>{getThemeSubtitle(name)}</Text>
                  </View>
                </View>
                {isActive ? <CheckCircle2 size={28} color="#5FAE7A" style={{ marginLeft: spacing.sm }} /> : <View style={{ width: 28, marginLeft: spacing.sm }} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

export function SafetyPrivacyScreen() {
  const { colors } = useTheme();
  const deleteAccount = useAppStore((state) => state.deleteAccount);

  const confirmDelete = () => {
    Alert.alert(
      "Delete Account?",
      "This action is permanent. All your data, connections, and choices will be immediately erased.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error) {
              Alert.alert("Error", error instanceof Error ? error.message : "Unable to delete account");
            }
          }
        }
      ]
    );
  };

  return (
    <Screen safeAreaEdges={nativeHeaderScreenEdges}>
      <Card>
        <Text style={[typography.h2, { color: colors.ink }]}>Stored data</Text>
        <Text style={[typography.body, { color: colors.ink }]}>
          Just Choose stores profiles, connection membership, choices, option names/photos, and answers.
        </Text>
      </Card>

      <Card>
        <Text style={[typography.h2, { color: colors.ink }]}>What we don't store</Text>
        <Text style={[typography.body, { color: colors.ink, marginBottom: 8 }]}>
          • No Ads: We don't track you for advertising.
        </Text>
        <Text style={[typography.body, { color: colors.ink }]}>
          • No Selling Data: Your data stays between you and your connection.
        </Text>
      </Card>

      <Card>
        <Text style={[typography.h2, { color: colors.ink }]}>Account Management</Text>
        <Text style={[typography.body, { color: colors.ink, marginBottom: 16 }]}>
          You have the right to delete your account and all associated data at any time. This action cannot be undone.
        </Text>
        <Button 
          label="Delete My Account" 
          variant="danger" 
          onPress={confirmDelete}
        />
      </Card>
    </Screen>
  );
}

export function LeaveConnectionConfirmScreen({ navigation }: Props<"LeaveConnectionConfirm">) {
  const leaveConnection = useAppStore((state) => state.leaveConnection);
  const { colors } = useTheme();

  return (
    <Screen title="Leave connection">
      <Card>
        <Text style={[typography.body, { color: colors.ink }]}>This removes the connection from this device.</Text>
        <Button
          label="Leave connection"
          variant="danger"
          onPress={async () => {
            try {
              await leaveConnection();
              navigation.replace("ConnectionInvite");
            } catch (error) {
              Alert.alert("Connection issue", getErrorMessage(error, "Unable to stop connection."));
            }
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function ManageConnectionsScreen({ navigation }: Props<"ManageConnections">) {
  const connection = useAppStore((state) => state.connection);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const authUserId = useAppStore((state) => state.authUserId);
  const updateConnectionAlias = useAppStore((state) => state.updateConnectionAlias);
  const leaveConnection = useAppStore((state) => state.leaveConnection);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const [displayName, setDisplayName] = useState(connectedProfile?.displayName ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const { colors } = useTheme();
  const uiStyles = useStyles();

  useEffect(() => {
    setDisplayName(connectedProfile?.displayName ?? "");
  }, [connectedProfile?.displayName]);

  if (!connection || !connectedProfile) {
    return (
      <Screen safeAreaEdges={nativeHeaderScreenEdges}>
        <Button label="Create invite" onPress={() => navigation.replace("ConnectionInvite")} />
      </Screen>
    );
  }

  async function handleAvatarPress() {
    if (!authUserId) return;
    const localUri = await chooseDecisionImage();
    if (!localUri) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadAvatarImage(authUserId, localUri);
      await updateConnectionAlias(displayName, uploaded.imageUrl, uploaded.imagePath);
    } catch (error) {
      Alert.alert("Upload issue", getErrorMessage(error, "Unable to upload avatar."));
    } finally {
      setIsUploading(false);
    }
  }

  async function saveDisplayName() {
    try {
      await updateConnectionAlias(displayName);
      Alert.alert("Connection updated", "This name is only visible to you.");
    } catch (error) {
      Alert.alert("Connection issue", getErrorMessage(error, "Unable to update connection."));
    }
  }

  function confirmStopConnection() {
    Alert.alert(
      "Stop connection?",
      "This disconnects both people and revokes pending invite codes for this connection.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop connection",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveConnection();
              navigation.replace("ConnectionInvite");
            } catch (error) {
              Alert.alert("Connection issue", getErrorMessage(error, "Unable to stop connection."));
            }
          },
        },
      ],
    );
  }

  return (
    <Screen safeAreaEdges={nativeHeaderScreenEdges}>
      <Card>
        <View style={uiStyles.brandRow}>
          <Pressable onPress={handleAvatarPress} disabled={isUploading}>
            <Avatar name={connectedProfile.displayName} size={54} imageUrl={connectedProfile.connectionAvatarUrl} />
          </Pressable>
          <View style={uiStyles.brandText}>
            <Text style={[typography.h2, { color: colors.ink }]}>{connectedProfile.displayName}</Text>
            <Text style={uiStyles.small}>
              Original profile name: {connectedProfile.profileDisplayName ?? connectedProfile.displayName}
            </Text>
          </View>
        </View>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={connectedProfile.profileDisplayName ?? "Their name"}
        />
        <Button
          label={remoteStatus === "loading" ? "Saving..." : "Save display name"}
          disabled={remoteStatus === "loading" || !displayName.trim()}
          onPress={saveDisplayName}
        />
        {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}
      </Card>
      <Card>
        <Text style={[typography.h2, { color: colors.ink }]}>Stop connection</Text>
        <Text style={uiStyles.small}>
          Use this if you no longer want to send choices to each other. You can create a new connection later.
        </Text>
        <Button
          label={remoteStatus === "loading" ? "Stopping..." : "Stop connection"}
          variant="danger"
          disabled={remoteStatus === "loading"}
          onPress={confirmStopConnection}
        />
      </Card>
    </Screen>
  );
}

function DecisionCard({ decision, onPress }: { decision: Decision; onPress: () => void }) {
  const firstImage = decision.options.find((option) => option.imageUrl)?.imageUrl;
  const selected = decision.options.find((option) => option.id === decision.response?.selectedOptionId);
  const { colors } = useTheme();
  const uiStyles = useStyles();

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
            <Text style={[typography.h2, { flex: 1, color: colors.ink }]}>{decision.title}</Text>
            <ChevronRight size={20} color={colors.muted} />
          </View>
          <Pill tone={decision.status === "answered" ? "green" : "coral"}>
            {decision.status === "answered" ? selected?.title ?? "Answered" : "Needs a pick"}
          </Pill>
          {firstImage ? (
            <OptionPreview title={decision.options[0]?.title ?? "Option"} imageUrl={firstImage} />
          ) : (
            <Text style={uiStyles.small}>{decision.options.length} options</Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

function SettingsRow({
  title,
  subtitle,
  icon,
  onPress,
  titleColor,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  titleColor?: string;
}) {
  const { colors } = useTheme();
  const uiStyles = useStyles();
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
          {icon}
          <View style={{ flex: 1 }}>
            <Text style={[typography.h2, { color: titleColor ?? colors.ink }]}>{title}</Text>
            <Text style={uiStyles.small}>{subtitle}</Text>
          </View>
          <ChevronRight size={24} color={colors.muted} strokeWidth={3} />
        </View>
      </Card>
    </Pressable>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={[typography.h2, { color: colors.ink }]}>{title}</Text>
      <Pill>{count}</Pill>
    </View>
  );
}

type CreateOptionDraft = {
  title: string;
  imageUrl: string | null;
};

function AttachmentCarousel({
  options,
  onAddImage,
  onUpdateOption,
  onRemoveOption,
  canRemove,
  canAdd,
  onAddOption,
}: {
  options: CreateOptionDraft[];
  onAddImage: (index: number) => void;
  onUpdateOption: (index: number, patch: Partial<CreateOptionDraft>) => void;
  onRemoveOption: (index: number) => void;
  canRemove: boolean;
  canAdd: boolean;
  onAddOption: () => void;
}) {
  const styles = useAttachmentStyles();
  const { colors } = useTheme();
  const cardColors = [colors.coral, colors.butter, colors.mint, colors.blueSoft, colors.peach, colors.purpleSoft];

  return (
    <View style={styles.section}>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={274}
        contentContainerStyle={styles.list}
        style={styles.scroller}
      >
        {options.map((option, index) => (
          <View
            key={index}
            style={[
              styles.attachmentCard,
              { backgroundColor: cardColors[index % cardColors.length] },
              index % 2 === 1 && styles.attachmentCardLifted,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add photo for option ${String.fromCharCode(65 + index)}`}
              onPress={() => onAddImage(index)}
              style={styles.photoTapArea}
            >
              {option.imageUrl ? (
                <Image source={{ uri: option.imageUrl }} style={styles.attachmentImage} />
              ) : (
                <View style={styles.plusBubble}>
                  <Plus size={54} color={colors.ink} strokeWidth={3.2} />
                </View>
              )}
            </Pressable>

            <TextInput
              value={option.title}
              onChangeText={(value) => onUpdateOption(index, { title: value })}
              placeholder={index === 0 ? "Sushi 🍣" : index === 1 ? "Thai 🍜" : "Name it"}
              placeholderTextColor={colors.muted}
              style={styles.optionInput}
            />
            {canRemove ? (
              <Pressable onPress={() => onRemoveOption(index)} style={styles.removePill}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add another option"
            onPress={onAddOption}
            style={[styles.attachmentCard, styles.addCard]}
          >
            <View style={styles.plusBubble}>
              <Plus size={54} color={colors.ink} strokeWidth={3.2} />
            </View>
            <Text style={styles.optionLabel}>Add chaos</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

type PrimaryTab = "home" | "history" | "saved" | "settings";

function FloatingTabBar({
  active,
  navigation,
}: {
  active: PrimaryTab;
  navigation: { navigate: (screen: "Home" | "History" | "Saved" | "Settings" | "CreateDecision") => void };
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const TabButton = ({ id, label, screen, icon: Icon }: any) => {
    const selected = id === active;
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          if (!selected) {
            navigation.navigate(screen);
          }
        }}
        style={[styles.tabItem, selected && styles.tabItemActive]}
      >
        <Icon size={22} color={selected ? colors.activeTabIcon : colors.ink} strokeWidth={2.2} />
      </Pressable>
    );
  };

  return (
    <View style={styles.tabBar}>
      <TabButton id="home" label="Home" screen="Home" icon={Home} />
      <TabButton id="history" label="History" screen="History" icon={Clock} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create new decision"
        onPress={() => navigation.navigate("CreateDecision")}
        style={({ pressed }) => [
          {
            alignItems: "center",
            justifyContent: "center",
            width: 58,
            height: 58,
            borderRadius: 29,
            marginTop: -8,
            marginBottom: -8,
            borderWidth: 3,
            borderColor: colors.ink,
            backgroundColor: colors.surface,
            shadowColor: colors.ink,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.16,
            shadowRadius: 0,
            elevation: 4,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
      >
        <LinearGradient
          colors={[colors.coral, colors.brandAccent] as const}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 29,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus size={28} color="#FFFFFF" strokeWidth={3} />
        </LinearGradient>
      </Pressable>

      <TabButton id="saved" label="Saved" screen="Saved" icon={Bookmark} />
      <TabButton id="settings" label="Settings" screen="Settings" icon={SlidersHorizontal} />
    </View>
  );
}

function ScreenHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: spacing.xs }}>
      <Text style={{
        fontSize: 28,
        lineHeight: 34,
        fontWeight: '900' as const,
        color: colors.ink,
        letterSpacing: -0.5,
        textTransform: 'uppercase' as const,
      }}>
        {title}
      </Text>
    </View>
  );
}


function useAttachmentStyles() {
  const { colors } = useTheme();

  return StyleSheet.create({
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    marker: {
      backgroundColor: colors.peach,
      borderRadius: 999,
      height: 7,
      transform: [{ rotate: "-4deg" }],
      width: 52,
    },
    scroller: {
      marginHorizontal: -spacing.xl,
    },
    list: {
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingRight: spacing.xxl * 2,
      paddingVertical: spacing.md,
    },
    attachmentCard: {
      borderColor: colors.ink,
      borderRadius: 34,
      borderWidth: 3,
      gap: spacing.md,
      minHeight: 314,
      padding: spacing.lg,
      shadowColor: colors.ink,
      shadowOffset: { width: 7, height: 9 },
      shadowOpacity: 0.18,
      shadowRadius: 0,
      width: 258,
      elevation: 6,
    },
    attachmentCardLifted: {
      marginTop: spacing.md,
      transform: [{ rotate: "1.2deg" }],
    },
    photoTapArea: {
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.66)",
      borderColor: colors.ink,
      borderRadius: 28,
      borderWidth: 2,
      height: 152,
      justifyContent: "center",
      overflow: "hidden",
    },
    plusBubble: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 999,
      borderWidth: 3,
      height: 96,
      justifyContent: "center",
      shadowColor: colors.ink,
      shadowOffset: { width: 4, height: 5 },
      shadowOpacity: 0.16,
      shadowRadius: 0,
      width: 96,
      elevation: 4,
    },
    attachmentImage: {
      height: "100%",
      width: "100%",
    },
    optionLabel: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    optionInput: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 22,
      borderWidth: 2,
      color: colors.ink,
      fontSize: 16,
      fontWeight: "900",
      minHeight: 54,
      paddingHorizontal: spacing.md,
    },
    removePill: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 999,
      borderWidth: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    removeText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    addCard: {
      alignItems: "center",
      backgroundColor: colors.amberSoft,
      justifyContent: "center",
    },
  });
}

function useDecisionCarouselStyles() {
  const { colors } = useTheme();

  return StyleSheet.create({
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
    cardLifted: {
      marginTop: spacing.md,
      transform: [{ rotate: "1.2deg" }],
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
      fontSize: 22,
      fontWeight: "900",
      textTransform: "uppercase",
      textAlign: "center",
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 2,
      borderColor: colors.ink,
    },
    dotActive: {
      backgroundColor: colors.coral,
      width: 24,
      borderRadius: 12,
    },
  });
}

function useHistoryStyles() {
  const { colors } = useTheme();

  return StyleSheet.create({
    topBar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: spacing.xs,
    },
    logo: {
      color: colors.ink,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    filterRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    filterChip: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    filterChipActive: {
      backgroundColor: colors.coral,
    },
    filterText: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: "700",
    },
    filterTextActive: {
      color: "#FFFFFF",
    },
    activityRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    receiptCard: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 22,
      borderWidth: 2,
      padding: spacing.md,
      shadowColor: colors.ink,
      shadowOffset: { width: 3, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 0,
      elevation: 2,
    },
    activityText: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "700",
      flexShrink: 1,
    },
    nameHighlight: {
      color: colors.coral,
      fontWeight: "900",
    },
    decisionTitle: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: "900",
      marginTop: spacing.xs,
      lineHeight: 22,
    },
    timestamp: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
    },
    thumbContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: spacing.sm,
    },
    thumbRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    thumb: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 16,
      borderWidth: 2,
      height: 64,
      width: 64,
    },
    thumbLabel: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
    },
    swipeActionArea: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 90,
      backgroundColor: colors.coral,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swipeActionText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
      marginTop: 4,
    },
  });
}

function MissingDecisionScreen({ navigation }: { navigation: { goBack: () => void } }) {
  return (
    <Screen title="Choice not found">
      <Button label="Back" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

function useDecision(decisionId: string) {
  return useAppStore((state) => state.decisions.find((decision) => decision.id === decisionId));
}
