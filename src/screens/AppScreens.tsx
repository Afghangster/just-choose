import React, { useEffect, useState, useMemo } from "react";
import { Alert, Animated, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Bookmark, CheckCircle2, ChevronRight, Clock, Copy, Home, LogOut, Mail, Plus, RefreshCw, Shield, SlidersHorizontal, Share2, ShieldCheck, Sparkles, UserRound, X, Zap } from "lucide-react-native";

import {
  ActivityCard,
  AnimatedResultCard,
  Button,
  Card,
  EmptyState,
  LargeTextField,
  OptionPreview,
  Pill,
  Screen,
  Segment,
  TextField,
  useStyles,
} from "../components/ui";
import { pickDecisionImage, uploadDecisionImage } from "../services/imageService";
import {
  completeOAuthSignIn,
  resendSignupConfirmation,
  signInWithAppleIdentityToken,
  signInWithEmail,
  signUpWithEmail,
  startGoogleSignIn,
  upsertProfile,
} from "../services/supabaseRepository";
import { useAppStore } from "../store/appStore";
import { useTheme, spacing, typography } from "../theme";
import type { RootStackParamList } from "../navigation/types";
import type { Connection, Decision, Gender, ResponseType } from "../types/domain";
import { createDecisionSchema } from "../validation/decisionSchemas";

type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

const brandIcon = require("../../JustChoose.png");

WebBrowser.maybeCompleteAuthSession();

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
    <Screen>
      <View style={{ gap: spacing.lg, paddingTop: 120, alignItems: "center" }}>
        <Animated.View style={{ opacity, transform: [{ translateY }], alignItems: "center", gap: spacing.lg }}>
          <Image source={brandIcon} style={{ height: 110, width: 140, resizeMode: 'contain' }} />
          <Pill tone="coral">End the 'where should we eat' debate.</Pill>
        </Animated.View>
      </View>
    </Screen>
  );
}

export function AuthScreen({ navigation }: Props<"Auth">) {
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const hydrateFromRemote = useAppStore((state) => state.hydrateFromRemote);
  const pendingInviteCode = useAppStore((state) => state.pendingInviteCode);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
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

  async function submitGoogle() {
    const redirectTo = "justchoose://auth/callback";
    setBusy(true);
    try {
      const { url } = await startGoogleSignIn(redirectTo);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
      if (result.type !== "success") {
        throw new Error("Google sign-in was cancelled.");
      }
      const authResult = await completeOAuthSignIn(result.url);
      await continueAfterAuth(authResult.userId);
    } catch (error) {
      Alert.alert("Google sign-in issue", getErrorMessage(error, "Try again."));
    } finally {
      setBusy(false);
    }
  }

  const platformButton =
    Platform.OS === "ios" ? (
      <Button
        label="Continue with Apple"
        variant="secondary"
        icon={<Shield size={18} color={colors.ink} />}
        disabled={busy}
        onPress={submitApple}
      />
    ) : Platform.OS === "android" ? (
      <Button
        label="Continue with Google"
        variant="secondary"
        icon={<Sparkles size={18} color={colors.ink} />}
        disabled={busy}
        onPress={submitGoogle}
      />
    ) : null;

  return (
    <Screen title="Just Choose" subtitle="Sign up fast. No phone number needed.">
      <Card>
        <View style={uiStyles.brandRow}>
          <Image source={brandIcon} style={uiStyles.brandIcon} />
          <View style={uiStyles.brandText}>
            <Text style={[typography.h2, { color: colors.ink }]}>Stop overthinking</Text>
            <Text style={uiStyles.small}>Create an account, add the basics, then start choosing.</Text>
          </View>
        </View>
        {platformButton}
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
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setMode(mode === "signup" ? "signin" : "signup")}
          style={({ pressed }) => [uiStyles.textButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={uiStyles.textButtonLabel}>
            {mode === "signup" ? "I already have an account" : "Create a new account"}
          </Text>
        </Pressable>
      </Card>
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
      <Card>
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
      <Card>
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
      {connection ? <PremiumStatusCard connection={connection} /> : null}
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
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const pending = decisions.filter((decision) => decision.status === "pending");
  const answered = decisions.filter((decision) => decision.status === "answered");
  const { colors } = useTheme();
  const uiStyles = useStyles();

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
      <Screen title="Just Choose">
        <Button label="Sign in" onPress={() => navigation.replace("Auth")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={`Hi ${profile.displayName}`}
      subtitle={connectedProfile ? "Make the tiny debate someone else's problem." : "Make the question now. Connect when you're ready to send it."}
      onRefresh={() => refreshRemoteState().catch(() => undefined)}
      refreshing={remoteStatus === "loading"}
      footer={<FloatingTabBar active="home" navigation={navigation} />}
    >
      <Button
        label="Make them choose"
        icon={<Zap size={18} color="#FFFFFF" />}
        onPress={() => navigation.navigate("CreateDecision")}
      />
      {connection ? null : (
        <Card>
          <Text style={[typography.h2, { color: colors.ink }]}>No connection yet</Text>
          <Text style={uiStyles.small}>
            You can draft a question now. When you tap submit, Just Choose will ask you to create or join a connection first.
          </Text>
        </Card>
      )}
      {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}

      <SectionHeader title="Waiting" count={pending.length} />
      {pending.length === 0 ? (
        <EmptyState title="Nothing waiting" body="No choices waiting for you. Start a tiny debate and make it official." />
      ) : (
        pending.map((decision) => {
          const isAssignee = profile?.id === decision.assignedTo;
          return (
            <DecisionCard
              key={decision.id}
              decision={decision}
              onPress={() => {
                if (isAssignee) {
                  navigation.navigate("AnswerDecision", { decisionId: decision.id });
                } else {
                  navigation.navigate("DecisionDetail", { decisionId: decision.id });
                }
              }}
            />
          );
        })
      )}

      <SectionHeader title="Answered" count={answered.length} />
      {answered.slice(0, 3).map((decision) => (
        <DecisionCard
          key={decision.id}
          decision={decision}
          onPress={() => navigation.navigate("DecisionResult", { decisionId: decision.id })}
        />
      ))}
    </Screen>
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
  const { colors } = useTheme();
  const uiStyles = useStyles();
  const histStyles = useHistoryStyles();

  const visible = decisions.filter((d) => !dismissed.has(d.id));

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  function activityText(decision: Decision): React.ReactNode {
    const isCreator = profile?.id === decision.createdBy;
    const connectedProfileName = connectedProfile?.displayName ?? "Your connection";
    const selectedOption = decision.response?.selectedOptionId
      ? decision.options.find((o) => o.id === decision.response?.selectedOptionId)
      : null;

    if (decision.status === "answered" && selectedOption) {
      if (isCreator) {
        // The connected person chose.
        return (
          <Text style={histStyles.activityText}>
            <Text style={histStyles.nameHighlight}>{connectedProfileName}</Text>
            {" chose '"}
            <Text style={histStyles.nameHighlight}>{selectedOption.title || selectedOption.label}</Text>
            {"'"}
          </Text>
        );
      }
      // You chose
      return (
        <Text style={histStyles.activityText}>
          <Text style={histStyles.nameHighlight}>You</Text>
          {" chose '"}
          <Text style={histStyles.nameHighlight}>{selectedOption.title || selectedOption.label}</Text>
          {"'"}
        </Text>
      );
    }

    if (decision.status === "pending") {
      if (isCreator) {
        return (
          <Text style={histStyles.activityText}>
            <Text style={histStyles.nameHighlight}>You</Text>
            {" are asking "}
            <Text style={histStyles.nameHighlight}>{connectedProfileName}</Text>
            {` '${decision.title}'`}
          </Text>
        );
      }
      return (
        <Text style={histStyles.activityText}>
          <Text style={histStyles.nameHighlight}>{connectedProfileName}</Text>
          {` asked '${decision.title}'`}
        </Text>
      );
    }

    // Answered without a specific option pick
    if (isCreator) {
      return (
        <Text style={histStyles.activityText}>
          <Text style={histStyles.nameHighlight}>You</Text>
          {" asked "}
          <Text style={histStyles.nameHighlight}>{connectedProfileName}</Text>
          {` '${decision.title}'`}
        </Text>
      );
    }
    return (
      <Text style={histStyles.activityText}>
        <Text style={histStyles.nameHighlight}>{connectedProfileName}</Text>
        {` asked '${decision.title}'`}
      </Text>
    );
  }

  const thumbnails = (decision: Decision) => {
    const images = decision.options.filter((o) => o.imageUrl).slice(0, 3);
    if (images.length === 0) return null;
    return (
      <View style={histStyles.thumbRow}>
        {images.map((o) => (
          <Image key={o.id} source={{ uri: o.imageUrl! }} style={histStyles.thumb} />
        ))}
      </View>
    );
  };

  return (
    <Screen
      onRefresh={() => refreshRemoteState().catch(() => undefined)}
      refreshing={remoteStatus === "loading"}
      footer={<FloatingTabBar active="history" navigation={navigation} />}
    >
      {/* Top bar: logo + plus icon */}
      <View style={histStyles.topBar}>
        <Image source={brandIcon} style={{ height: 36, width: 46, resizeMode: 'contain' }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New question"
          onPress={() => navigation.navigate("CreateDecision")}
          style={({ pressed }) => [histStyles.plusBtn, pressed && { opacity: 0.6 }]}
        >
          <Plus size={28} color={colors.border} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Section heading */}
      <Text style={histStyles.sectionHeading}>Recent activity</Text>

      {remoteError ? <Text style={uiStyles.small}>{remoteError}</Text> : null}

      {visible.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Your choices and answers will appear here." />
      ) : (
        visible.map((decision) => (
          <Pressable
            key={decision.id}
            onPress={() => {
              if (decision.status === "answered") {
                navigation.navigate("DecisionResult", { decisionId: decision.id });
              } else if (profile?.id === decision.assignedTo) {
                navigation.navigate("AnswerDecision", { decisionId: decision.id });
              } else {
                navigation.navigate("DecisionDetail", { decisionId: decision.id });
              }
            }}
          >
            <ActivityCard>
              {/* Dismiss X */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                onPress={() => dismiss(decision.id)}
                style={histStyles.dismissBtn}
              >
                <X size={16} color="#FFFFFF" strokeWidth={2.6} />
              </Pressable>

              {/* Activity description */}
              {activityText(decision)}

              {/* Image thumbnails */}
              {thumbnails(decision)}

              {/* Timestamp */}
              <Text style={histStyles.timestamp}>{timeAgo(decision.updatedAt ?? decision.createdAt)}</Text>
            </ActivityCard>
          </Pressable>
        ))
      )}

      {!profile ? <Button label="Sign in" onPress={() => navigation.replace("Auth")} /> : null}
    </Screen>
  );
}

export function SavedScreen({ navigation }: Props<"Saved">) {
  const { colors } = useTheme();
  return (
    <Screen footer={<FloatingTabBar active="saved" navigation={navigation} />}>
      <View style={{ paddingTop: spacing.sm }}>
        <Image source={brandIcon} style={{ height: 36, width: 46, resizeMode: 'contain' }} />
      </View>
      <Text style={[typography.h2, { color: colors.ink }]}>Saved</Text>
      <EmptyState title="Nothing saved yet" body="Bookmark your favourite choices and they'll show up here." />
    </Screen>
  );
}

export function CreateDecisionScreen({ navigation }: Props<"CreateDecision">) {
  const profile = useAppStore((state) => state.profile);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const connection = useAppStore((state) => state.connection);
  const createRemoteDecision = useAppStore((state) => state.createRemoteDecision);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [options, setOptions] = useState([
    { title: "", imageUrl: null as string | null },
    { title: "", imageUrl: null as string | null },
  ]);
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
    const picked = await pickDecisionImage();
    if (!picked) {
      return;
    }

    try {
      const uri = profile ? await uploadDecisionImage(profile.id, picked) : picked;
      updateOption(index, { imageUrl: uri });
    } catch (error) {
      Alert.alert("Image upload issue", error instanceof Error ? error.message : "Try again.");
      updateOption(index, { imageUrl: picked });
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

    if (!connection.premiumEnabled) {
      Alert.alert("Premium needed", "One active connection subscription unlocks choices for both connected people.");
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
        })),
      });
      navigation.replace("DecisionDetail", { decisionId: decision.id });
    } catch (error) {
      Alert.alert("Choice issue", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <LargeTextField
        label="Drop the question"
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
        onAddOption={() => setOptions((current) => [...current, { title: "", imageUrl: null }])}
      />

      <Button label={busy ? "LAUNCHING..." : "JUST CHOOSE"} disabled={busy} onPress={submit} />
    </Screen>
  );
}

export function DecisionDetailScreen({ route, navigation }: Props<"DecisionDetail">) {
  const decision = useDecision(route.params.decisionId);
  const profile = useAppStore((state) => state.profile);
  const connectedProfile = useAppStore((state) => state.connectedProfile);
  const { colors } = useTheme();

  if (!decision) {
    return <MissingDecisionScreen navigation={navigation} />;
  }

  const canAnswer = profile?.id === decision.assignedTo && decision.status === "pending";
  const isCreator = profile?.id === decision.createdBy;

  return (
    <Screen title={decision.title} subtitle={decision.status === "answered" ? "Answered" : "Waiting for an answer"}>
      {decision.note ? (
        <Card>
          <Text style={[typography.body, { color: colors.ink }]}>{decision.note}</Text>
        </Card>
      ) : null}
      {decision.options.map((option) => (
        <OptionPreview
          key={option.id}
          title={option.title || option.label}
          imageUrl={option.imageUrl}
        />
      ))}
      {decision.status === "answered" ? (
        <Button label="Show the verdict" onPress={() => navigation.navigate("DecisionResult", { decisionId: decision.id })} />
      ) : canAnswer ? (
        <Button label="Just choose" onPress={() => navigation.navigate("AnswerDecision", { decisionId: decision.id })} />
      ) : isCreator ? (
        <Card>
          <Text style={[typography.body, { color: colors.ink }]}>
            Sent to {connectedProfile?.displayName ?? "your connection"}. They need to choose.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

export function AnswerDecisionScreen({ route, navigation }: Props<"AnswerDecision">) {
  const decision = useDecision(route.params.decisionId);
  const answerRemoteDecision = useAppStore((state) => state.answerRemoteDecision);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const { colors } = useTheme();

  if (!decision) {
    return <MissingDecisionScreen navigation={navigation} />;
  }
  const currentDecision = decision;

  async function submit(responseType: ResponseType, optionId = selectedOptionId) {
    await answerRemoteDecision(currentDecision.id, {
      responseType,
      selectedOptionId: optionId,
      comment,
    });
    navigation.replace("DecisionResult", { decisionId: currentDecision.id });
  }

  return (
    <Screen title="Just choose" subtitle={currentDecision.note ?? undefined}>
      {currentDecision.options.map((option) => {
        const selected = selectedOptionId === option.id;
        return (
          <Pressable key={option.id} onPress={() => setSelectedOptionId(option.id)}>
            <View style={[selected && { borderColor: colors.coral, borderWidth: 4, borderRadius: 34 }]}>
              <OptionPreview
                title={option.title || option.label}
                imageUrl={option.imageUrl}
              />
            </View>
          </Pressable>
        );
      })}
      <TextField label="Comment" value={comment} onChangeText={setComment} multiline placeholder="Optional" />
      <Button
        label={remoteStatus === "loading" ? "Choosing..." : "Just choose"}
        disabled={!selectedOptionId || remoteStatus === "loading"}
        onPress={() => submit("selected_option")}
      />
    </Screen>
  );
}

export function DecisionResultScreen({ route, navigation }: Props<"DecisionResult">) {
  const decision = useDecision(route.params.decisionId);
  const uiStyles = useStyles();
  const { colors } = useTheme();

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

  return (
    <Screen title="Result" subtitle={response ? phrase : decision.title}>
      {!response ? (
        <EmptyState title="No answer yet" body="The choice is still waiting." />
      ) : (
        <AnimatedResultCard>
          {selected ? (
            <>
              {selected.imageUrl ? <Image source={{ uri: selected.imageUrl }} style={{ width: 160, height: 160, borderRadius: 24, borderWidth: 4, borderColor: colors.ink }} /> : null}
              <Text style={{ fontSize: 32, fontWeight: "900", color: colors.ink, textAlign: "center", textTransform: "uppercase" }}>
                {selected.title || selected.label}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 32, fontWeight: "900", color: colors.ink, textAlign: "center", textTransform: "uppercase" }}>
              Could not choose
            </Text>
          )}
          {response.comment ? <Text style={[typography.body, { color: colors.ink, textAlign: "center", fontStyle: "italic" }]}>"{response.comment}"</Text> : null}
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", fontWeight: "700" }}>Answered {new Date(response.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</Text>
        </AnimatedResultCard>
      )}
      <Button label="Back to chaos" onPress={() => navigation.navigate("Home")} />
    </Screen>
  );
}

export function SettingsScreen({ navigation }: Props<"Settings">) {
  const { colors } = useTheme();
  const connection = useAppStore((state) => state.connection);
  const signOut = useAppStore((state) => state.signOut);
  return (
    <Screen title="Settings" footer={<FloatingTabBar active="settings" navigation={navigation} />}>
      {connection ? <PremiumStatusCard connection={connection} /> : null}
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
        icon={<LogOut size={24} color={colors.coral} strokeWidth={3} />}
        titleColor={colors.coral}
        onPress={async () => {
          try {
            await signOut();
            navigation.replace("Auth");
          } catch (error) {
            Alert.alert("Log out issue", error instanceof Error ? error.message : "Unable to log out.");
          }
        }}
      />
    </Screen>
  );
}

export function SafetyPrivacyScreen() {
  const { colors } = useTheme();
  return (
    <Screen title="Safety and privacy" subtitle="Simple by design.">
      <Card>
        <Text style={[typography.h2, { color: colors.ink }]}>Stored data</Text>
        <Text style={[typography.body, { color: colors.ink }]}>
          Just Choose stores profiles, connection membership, choices, option names/photos, and answers.
        </Text>
      </Card>
      <Card>
        <Text style={[typography.h2, { color: colors.ink }]}>Not in v1</Text>
        <Text style={[typography.body, { color: colors.ink }]}>
          No categories, urgency, boards, notification preferences, or Decision Lock data.
        </Text>
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
  const updateConnectionDisplayName = useAppStore((state) => state.updateConnectionDisplayName);
  const leaveConnection = useAppStore((state) => state.leaveConnection);
  const remoteStatus = useAppStore((state) => state.remoteStatus);
  const remoteError = useAppStore((state) => state.remoteError);
  const [displayName, setDisplayName] = useState(connectedProfile?.displayName ?? "");
  const { colors } = useTheme();
  const uiStyles = useStyles();

  useEffect(() => {
    setDisplayName(connectedProfile?.displayName ?? "");
  }, [connectedProfile?.displayName]);

  if (!connection || !connectedProfile) {
    return (
      <Screen title="Manage connections" subtitle="No active connection yet.">
        <Button label="Create invite" onPress={() => navigation.replace("ConnectionInvite")} />
      </Screen>
    );
  }

  async function saveDisplayName() {
    try {
      await updateConnectionDisplayName(displayName);
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
    <Screen title="Manage connections" subtitle="Keep your labels clear before you send a choice.">
      <Card>
        <View style={uiStyles.brandRow}>
          <Image source={brandIcon} style={uiStyles.brandIcon} />
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

function PremiumStatusCard({ connection }: { connection: Connection }) {
  const { colors } = useTheme();
  const uiStyles = useStyles();
  const label = connection.premiumEnabled ? "Premium active" : "Premium inactive";
  const body = connection.premiumEnabled
    ? "One subscription is covering both connected people."
    : "One connected person needs an active connection subscription to unlock shared premium features.";

  return (
    <Card>
      <View style={{ gap: spacing.sm }}>
        <Pill tone={connection.premiumEnabled ? "green" : "amber"}>{label}</Pill>
        <Text style={[typography.h2, { color: colors.ink }]}>
          {connection.plan === "free" ? "Connection access" : `${connection.plan} access`}
        </Text>
        <Text style={uiStyles.small}>{body}</Text>
      </View>
    </Card>
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
  navigation: { navigate: (screen: "Home" | "History" | "Saved" | "Settings") => void };
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const items: Array<{
    id: PrimaryTab;
    label: string;
    screen: "Home" | "History" | "Saved" | "Settings";
    icon: typeof Home;
  }> = [
    { id: "home", label: "Home", screen: "Home", icon: Home },
    { id: "history", label: "Recent", screen: "History", icon: Clock },
    { id: "saved", label: "Saved", screen: "Saved", icon: Bookmark },
    { id: "settings", label: "Settings", screen: "Settings", icon: SlidersHorizontal },
  ];

  return (
    <View style={styles.tabBar}>
      {items.map((item) => {
        const selected = item.id === active;
        const Icon = item.icon;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => {
              if (!selected) {
                navigation.navigate(item.screen);
              }
            }}
            style={[styles.tabItem, selected && styles.tabItemActive]}
          >
            <Icon size={22} color={selected ? colors.coral : colors.ink} strokeWidth={2.2} />
          </Pressable>
        );
      })}
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
    plusBtn: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    sectionHeading: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    activityText: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 24,
      paddingRight: 28,
    },
    nameHighlight: {
      color: colors.coral,
      fontWeight: "900",
    },
    dismissBtn: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.18)",
      borderRadius: 999,
      height: 24,
      justifyContent: "center",
      position: "absolute",
      right: 12,
      top: 12,
      width: 24,
      zIndex: 2,
    },
    timestamp: {
      alignSelf: "flex-end",
      color: "rgba(255,255,255,0.72)",
      fontSize: 12,
      fontWeight: "700",
      marginTop: spacing.sm,
    },
    thumbRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    thumb: {
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: 14,
      borderWidth: 2,
      height: 56,
      width: 56,
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
