import { supabase } from "../lib/supabase";
import type {
  ChoiceOptionInput,
  Connection,
  ConnectionRequest,
  Decision,
  DecisionOption,
  DecisionResponse,
  Gender,
  Profile,
  ResponseType,
} from "../types/domain";

type SupabaseLike = {
  auth: {
    getUser(): Promise<{ data: { user: { id: string; email?: string } | null }; error: Error | null }>;
    signInWithPassword(input: { email: string; password: string }): Promise<{ data: { user: { id: string } | null }; error: Error | null }>;
    signInWithOAuth(input: {
      provider: "google";
      options: { redirectTo: string; skipBrowserRedirect: true };
    }): Promise<{ data: { url: string | null }; error: Error | null }>;
    exchangeCodeForSession(code: string): Promise<{ data: { user: { id: string } | null }; error: Error | null }>;
    signInWithIdToken(input: {
      provider: "apple";
      token: string;
      nonce?: string;
    }): Promise<{ data: { user: { id: string } | null }; error: Error | null }>;
    signInWithOtp(input: { phone: string }): Promise<{ data: unknown; error: Error | null }>;
    verifyOtp(input: { phone: string; token: string; type: "sms" }): Promise<{ data: { user: { id: string } | null; session?: unknown | null }; error: Error | null }>;
    signUp(input: { email: string; password: string; options?: { emailRedirectTo?: string } }): Promise<{
      data: { user: { id: string } | null; session?: unknown | null };
      error: Error | null;
    }>;
    resend?(input: {
      type: "signup";
      email: string;
      options?: { emailRedirectTo?: string };
    }): Promise<{ data: unknown; error: Error | null }>;
    signOut(): Promise<{ error: Error | null }>;
  };
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): any;
};

export type RemoteAppState = {
  authUserId: string | null;
  profile: Profile | null;
  connectedProfile: Profile | null;
  connection: Connection | null;
  pendingConnectionRequests: ConnectionRequest[];
  decisions: Decision[];
};

export type RemoteDecisionInput = {
  note?: string | null;
  options: ChoiceOptionInput[];
};

export type RemoteResponseInput = {
  responseType: ResponseType;
  selectedOptionId?: string | null;
  comment?: string | null;
};

export type ConnectionInvitePreview = {
  code: string;
  inviterDisplayName: string;
  expiresAt: string;
};

export type SignUpResult = {
  userId: string | null;
  needsEmailConfirmation: boolean;
  email: string;
};

export type AppRepository = {
  signInWithEmail(email: string, password: string): Promise<{ userId: string }>;
  signUpWithEmail(email: string, password: string): Promise<SignUpResult>;
  resendSignupConfirmation(email: string): Promise<void>;
  startGoogleSignIn(redirectTo: string): Promise<{ url: string }>;
  completeOAuthSignIn(callbackUrl: string): Promise<{ userId: string }>;
  signInWithAppleIdentityToken(identityToken: string): Promise<{ userId: string }>;
  signInWithPhoneOtp(phone: string): Promise<void>;
  verifyPhoneOtp(phone: string, token: string): Promise<{ userId: string }>;
  loadCurrentUserAppState(): Promise<RemoteAppState>;
  upsertProfile(profile: Profile): Promise<RemoteAppState>;
  createConnectionInvite(): Promise<RemoteAppState>;
  previewConnectionInvite(inviteCode: string): Promise<ConnectionInvitePreview>;
  acceptConnectionInvite(inviteCode: string): Promise<RemoteAppState>;
  joinConnectionByInviteCode(inviteCode: string): Promise<RemoteAppState>;
  approveConnectionRequest(requesterId: string): Promise<RemoteAppState>;
  rejectConnectionRequest(requesterId: string): Promise<RemoteAppState>;
  createDecisionWithOptions(input: RemoteDecisionInput): Promise<Decision>;
  answerDecision(decisionId: string, input: RemoteResponseInput): Promise<DecisionResponse>;
  savePushToken(userId: string, token: string, platform?: string | null): Promise<void>;
  updateConnectionDisplayName(input: { connectionId: string; targetUserId: string; displayName: string }): Promise<RemoteAppState>;
  stopConnection(connectionId: string): Promise<RemoteAppState>;
  signOut(): Promise<void>;
};

const emptyRemoteState = (authUserId: string | null = null): RemoteAppState => ({
  authUserId,
  profile: null,
  connectedProfile: null,
  connection: null,
  pendingConnectionRequests: [],
  decisions: [],
});

let mockState: RemoteAppState = emptyRemoteState();

export function createSupabaseRepository(client: SupabaseLike | null): AppRepository {
  async function currentUserId() {
    if (!client) {
      return mockState.authUserId;
    }

    const { data, error } = await client.auth.getUser();
    if (error) {
      throw error;
    }
    return data.user?.id ?? null;
  }

  async function requireUserId() {
    const userId = await currentUserId();
    if (!userId) {
      throw new Error("You need to sign in first.");
    }
    return userId;
  }

  async function loadCurrentUserAppState(): Promise<RemoteAppState> {
    if (!client) {
      return mockState;
    }

    const userId = await currentUserId();
    if (!userId) {
      return emptyRemoteState();
    }

    const profile = await selectMaybe<ProfileRow>("profiles", (query) =>
      query.select("*").eq("id", userId).maybeSingle(),
    );
    if (!profile) {
      return emptyRemoteState(userId);
    }

    const membershipRows = await selectMany<ConnectionMemberRow>("connection_members", (query) =>
      query.select("*").eq("user_id", userId).eq("status", "accepted").limit(1),
    );
    const membership = membershipRows[0];
    if (!membership) {
      return {
        ...emptyRemoteState(userId),
        profile: toProfile(profile),
      };
    }

    const connection = await selectSingle<ConnectionRow>("connections", (query) =>
      query.select("*").eq("id", membership.connection_id).single(),
    );
    const members = await selectMany<ConnectionMemberRow>("connection_members", (query) =>
      query.select("*").eq("connection_id", connection.id).eq("status", "accepted"),
    );
    const memberIds = members.map((member) => member.user_id);
    const profiles = memberIds.length
      ? await selectMany<ProfileRow>("profiles", (query) => query.select("*").in("id", memberIds))
      : [];
    const connectedProfile = profiles.find((item) => item.id !== userId) ?? null;
    const alias = connectedProfile
      ? await selectMaybe<ConnectionAliasRow>("connection_aliases", (query) =>
          query
            .select("*")
            .eq("connection_id", connection.id)
            .eq("owner_user_id", userId)
            .eq("target_user_id", connectedProfile.id)
            .maybeSingle(),
        )
      : null;
    const inviteRows = connectedProfile
      ? []
      : await selectMany<ConnectionInviteRow>("connection_invites", (query) =>
          query
            .select("*")
            .eq("connection_id", connection.id)
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1),
        );
    const pendingConnectionRequests = connectedProfile
      ? []
      : await loadPendingConnectionRequests();

    const decisions = await selectMany<DecisionRow>("decisions", (query) =>
      query.select("*").eq("connection_id", connection.id).order("created_at", { ascending: false }),
    );
    const decisionIds = decisions.map((decision) => decision.id);
    const options = decisionIds.length
      ? await selectMany<DecisionOptionRow>("decision_options", (query) =>
          query.select("*").in("decision_id", decisionIds).order("sort_order", { ascending: true }),
        )
      : [];
    const responses = decisionIds.length
      ? await selectMany<DecisionResponseRow>("decision_responses", (query) =>
          query.select("*").in("decision_id", decisionIds).order("created_at", { ascending: false }),
        )
      : [];

    return {
      authUserId: userId,
      profile: toProfile(profile),
      connectedProfile: connectedProfile ? toProfile(connectedProfile, alias?.display_name ?? null) : null,
      connection: toConnection(connection, inviteRows[0]),
      pendingConnectionRequests,
      decisions: decisions.map((decision) => toDecision(decision, options, responses)),
    };
  }

  async function loadPendingConnectionRequests(): Promise<ConnectionRequest[]> {
    if (!client) {
      return mockState.pendingConnectionRequests;
    }
    const { data, error } = await client.rpc("pending_connection_requests");
    if (error) {
      throw error;
    }
    return (Array.isArray(data) ? data : []).map((row) =>
      toConnectionRequest(row as ConnectionRequestRow),
    );
  }

  async function selectSingle<T>(table: string, build: (query: any) => PromiseLike<QueryResult<T>>) {
    const { data, error } = await build(client!.from(table));
    if (error) {
      throw error;
    }
    return data as T;
  }

  async function selectMaybe<T>(table: string, build: (query: any) => PromiseLike<QueryResult<T | null>>) {
    const { data, error } = await build(client!.from(table));
    if (error) {
      throw error;
    }
    return data as T | null;
  }

  async function selectMany<T>(table: string, build: (query: any) => PromiseLike<QueryResult<T[]>>) {
    const { data, error } = await build(client!.from(table));
    if (error) {
      throw error;
    }
    return (data ?? []) as T[];
  }

  return {
    async signInWithEmail(email, password) {
      if (!client) {
        mockState.authUserId = `local-${email.toLowerCase()}`;
        return { userId: mockState.authUserId };
      }
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      if (!data.user) {
        throw new Error("Sign in did not return a user. Please try again.");
      }
      return { userId: data.user!.id };
    },

    async signUpWithEmail(email, password) {
      if (!client) {
        mockState.authUserId = `local-${email.toLowerCase()}`;
        return { userId: mockState.authUserId, needsEmailConfirmation: false, email };
      }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "justchoose://auth/callback",
        },
      });
      if (error) {
        throw error;
      }
      if (!data.session) {
        return {
          userId: data.user?.id ?? null,
          needsEmailConfirmation: true,
          email,
        };
      }
      if (!data.user) {
        throw new Error("Signup did not return a user. Please try again.");
      }
      return { userId: data.user.id, needsEmailConfirmation: false, email };
    },

    async resendSignupConfirmation(email) {
      if (!client) {
        return;
      }
      if (!client.auth.resend) {
        throw new Error("Email confirmation resend is not available.");
      }
      const { error } = await client.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: "justchoose://auth/callback",
        },
      });
      if (error) {
        throw error;
      }
    },

    async startGoogleSignIn(redirectTo) {
      if (!client) {
        return { url: "justchoose://auth/callback?code=mock" };
      }
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        throw error;
      }
      if (!data.url) {
        throw new Error("Google sign-in did not return a login URL.");
      }
      return { url: data.url };
    },

    async completeOAuthSignIn(callbackUrl) {
      const code = new URL(callbackUrl).searchParams.get("code");
      if (!code) {
        throw new Error("Sign-in was cancelled or did not return a code.");
      }
      if (!client) {
        mockState.authUserId = "local-oauth-user";
        return { userId: mockState.authUserId };
      }
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
      if (!data.user) {
        throw new Error("Sign-in did not return a user. Please try again.");
      }
      return { userId: data.user.id };
    },

    async signInWithAppleIdentityToken(identityToken) {
      if (!client) {
        mockState.authUserId = "local-apple-user";
        return { userId: mockState.authUserId };
      }
      const { data, error } = await client.auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
      });
      if (error) {
        throw error;
      }
      if (!data.user) {
        throw new Error("Apple sign-in did not return a user. Please try again.");
      }
      return { userId: data.user.id };
    },

    async signInWithPhoneOtp(phone) {
      if (!client) {
        return;
      }
      const { error } = await client.auth.signInWithOtp({ phone });
      if (error) {
        throw error;
      }
    },

    async verifyPhoneOtp(phone, token) {
      if (!client) {
        mockState.authUserId = `local-${phone.replace(/\D/g, "")}`;
        return { userId: mockState.authUserId };
      }
      const { data, error } = await client.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (error) {
        throw error;
      }
      if (!data.user) {
        throw new Error("Phone verification did not return a user. Please try again.");
      }
      return { userId: data.user.id };
    },

    loadCurrentUserAppState,

    async upsertProfile(profile) {
      if (!client) {
        mockState.authUserId = profile.id;
        mockState.profile = profile;
        return mockState;
      }
      const { error } = await client.from("profiles").upsert({
        id: profile.id,
        display_name: profile.displayName,
        age: profile.age ?? null,
        gender: profile.gender ?? null,
        avatar_url: profile.avatarUrl ?? null,
      });
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async createConnectionInvite() {
      if (!client) {
        mockState.connection = {
          id: "mock-connection",
          inviteCode: "MOCKCODE",
          inviteExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          createdBy: mockState.profile?.id ?? "mock",
          billingOwnerUserId: null,
          subscriptionStatus: "inactive",
          plan: "free",
          premiumEnabled: false,
          subscriptionCurrentPeriodEnd: null,
          createdAt: new Date().toISOString(),
        };
        return mockState;
      }
      const { error } = await client.rpc("create_connection_invite");
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async previewConnectionInvite(inviteCode) {
      if (!client) {
        return {
          code: inviteCode,
          inviterDisplayName: "Mock Connection",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
      }
      const { data, error } = await client.rpc("preview_connection_invite", {
        invite_code_input: normalizeInviteCode(inviteCode),
      });
      if (error) {
        throw error;
      }

      const previewRow = Array.isArray(data) ? data[0] : data;
      if (!previewRow) {
        throw new Error("Invite code not found or expired.");
      }

      return toConnectionInvitePreview(previewRow as ConnectionInvitePreviewRow);
    },

    async acceptConnectionInvite(inviteCode) {
      if (!client) {
        return mockState;
      }
      const { error } = await client.rpc("accept_connection_invite", {
        invite_code_input: normalizeInviteCode(inviteCode),
      });
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async joinConnectionByInviteCode(inviteCode) {
      if (!client) {
        return mockState;
      }
      const { error } = await client.rpc("accept_connection_invite", {
        invite_code_input: normalizeInviteCode(inviteCode),
      });
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async approveConnectionRequest(requesterId) {
      if (!client) {
        mockState.pendingConnectionRequests = mockState.pendingConnectionRequests.filter(
          (request) => request.requesterId !== requesterId,
        );
        return mockState;
      }
      const { error } = await client.rpc("approve_connection_request", {
        requester_user_id: requesterId,
      });
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async rejectConnectionRequest(requesterId) {
      if (!client) {
        mockState.pendingConnectionRequests = mockState.pendingConnectionRequests.filter(
          (request) => request.requesterId !== requesterId,
        );
        return mockState;
      }
      const { error } = await client.rpc("reject_connection_request", {
        requester_user_id: requesterId,
      });
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async createDecisionWithOptions(input) {
      if (!client) {
        const decisionId = "mock-decision-" + Date.now();
        const options = input.options.map((opt, idx) => ({
          id: "mock-opt-" + idx,
          decisionId,
          label: opt.label,
          title: opt.title ?? null,
          imageUrl: opt.imageUrl ?? null,
          sortOrder: idx,
        }));
        const decision: Decision = {
          id: decisionId,
          connectionId: mockState.connection?.id ?? "mock",
          createdBy: mockState.profile?.id ?? "mock",
          assignedTo: mockState.connectedProfile?.id ?? "mock",
          title: makeDecisionTitle(options),
          note: input.note ?? null,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          answeredAt: null,
          options,
          response: null,
        };
        mockState.decisions.unshift(decision);
        return decision;
      }
      const state = await loadCurrentUserAppState();
      if (!state.profile || !state.connection || !state.connectedProfile) {
        throw new Error("Create a connection before creating choices.");
      }

      const createdAt = new Date().toISOString();
      const decision = await selectSingle<DecisionRow>("decisions", (query) =>
        query
          .insert({
            connection_id: state.connection!.id,
            created_by: state.profile!.id,
            assigned_to: state.connectedProfile!.id,
            note: input.note?.trim() || null,
            status: "pending",
            created_at: createdAt,
            updated_at: createdAt,
          })
          .select("*")
          .single(),
      );
      const optionRows = input.options.slice(0, 6).map((option, index) => ({
        decision_id: decision.id,
        label: option.label,
        title: option.title?.trim() || null,
        image_url: option.imageUrl ?? null,
        sort_order: index,
        created_at: createdAt,
      }));
      const options = await selectMany<DecisionOptionRow>("decision_options", (query) =>
        query.insert(optionRows).select("*").order("sort_order", { ascending: true }),
      );
      const created = toDecision(decision, options, []);
      const tokens = await selectMany<PushTokenRow>("push_tokens", (query) =>
        query.select("*").eq("user_id", state.connectedProfile!.id),
      );
      await sendChoicePushNotifications(
        tokens.map((row) => row.token),
        state.profile.displayName,
        created,
      );
      return created;
    },

    async answerDecision(decisionId, input) {
      if (!client) {
        const decision = mockState.decisions.find((d) => d.id === decisionId);
        if (!decision) throw new Error("Decision not found");
        
        const response: DecisionResponse = {
          id: "mock-response-" + Date.now(),
          decisionId,
          responderId: mockState.profile?.id ?? "mock",
          selectedOptionId: input.selectedOptionId ?? null,
          responseType: input.responseType,
          comment: input.comment ?? null,
          createdAt: new Date().toISOString(),
        };
        
        decision.status = "answered";
        decision.answeredAt = response.createdAt;
        decision.response = response;
        return response;
      }
      const userId = await requireUserId();
      const createdAt = new Date().toISOString();
      const response = await selectSingle<DecisionResponseRow>("decision_responses", (query) =>
        query
          .insert({
            decision_id: decisionId,
            responder_id: userId,
            selected_option_id: input.selectedOptionId ?? null,
            response_type: input.responseType,
            comment: input.comment ?? null,
            created_at: createdAt,
          })
          .select("*")
          .single(),
      );
      return toResponse(response);
    },

    async savePushToken(userId, token, platform = null) {
      if (!client) {
        return;
      }
      const { error } = await client.from("push_tokens").upsert({
        user_id: userId,
        token,
        platform,
      });
      if (error) {
        throw error;
      }
    },

    async updateConnectionDisplayName({ connectionId, targetUserId, displayName }) {
      if (!client) {
        if (mockState.connectedProfile?.id === targetUserId) {
          mockState.connectedProfile = {
            ...mockState.connectedProfile,
            displayName: displayName.trim(),
            connectionDisplayName: displayName.trim(),
          };
        }
        return mockState;
      }

      const ownerUserId = await requireUserId();
      const { error } = await client.from("connection_aliases").upsert(
        {
          connection_id: connectionId,
          owner_user_id: ownerUserId,
          target_user_id: targetUserId,
          display_name: displayName.trim(),
        },
        { onConflict: "connection_id,owner_user_id,target_user_id" },
      );
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async stopConnection(connectionId) {
      if (!client) {
        mockState = {
          ...mockState,
          connection: null,
          connectedProfile: null,
          decisions: [],
        };
        return mockState;
      }
      const { error } = await client.rpc("stop_connection", {
        target_connection_id: connectionId,
      });
      if (error) {
        throw error;
      }
      return loadCurrentUserAppState();
    },

    async signOut() {
      if (!client) {
        mockState = emptyRemoteState();
        return;
      }
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }
    },
  };
}

export let appRepository: AppRepository = createSupabaseRepository(supabase as SupabaseLike | null);

export function setAppRepositoryForTesting(repository: AppRepository) {
  appRepository = repository;
}

export function resetAppRepositoryForTesting() {
  appRepository = createSupabaseRepository(supabase as SupabaseLike | null);
}

export const signInWithEmail = (email: string, password: string) =>
  appRepository.signInWithEmail(email, password);
export const signUpWithEmail = (email: string, password: string) =>
  appRepository.signUpWithEmail(email, password);
export const resendSignupConfirmation = (email: string) =>
  appRepository.resendSignupConfirmation(email);
export const startGoogleSignIn = (redirectTo: string) =>
  appRepository.startGoogleSignIn(redirectTo);
export const completeOAuthSignIn = (callbackUrl: string) =>
  appRepository.completeOAuthSignIn(callbackUrl);
export const signInWithAppleIdentityToken = (identityToken: string) =>
  appRepository.signInWithAppleIdentityToken(identityToken);
export const signInWithPhoneOtp = (phone: string) =>
  appRepository.signInWithPhoneOtp(phone);
export const verifyPhoneOtp = (phone: string, token: string) =>
  appRepository.verifyPhoneOtp(phone, token);
export const upsertProfile = (profile: Profile) => appRepository.upsertProfile(profile);

type QueryResult<T> = {
  data: T;
  error: Error | null;
};

type ProfileRow = {
  id: string;
  display_name: string;
  age: number | null;
  gender: Gender | null;
  avatar_url: string | null;
};

type ConnectionAliasRow = {
  id: string;
  connection_id: string;
  owner_user_id: string;
  target_user_id: string;
  display_name: string;
};

type ConnectionRow = {
  id: string;
  invite_code: string;
  created_by: string;
  billing_owner_user_id?: string | null;
  subscription_status?: "inactive" | "trialing" | "active" | "past_due" | "canceled";
  plan?: string;
  subscription_current_period_end?: string | null;
  created_at: string;
};

type ConnectionMemberRow = {
  id: string;
  connection_id: string;
  user_id: string;
  role: string;
  status?: "invited" | "accepted" | "declined" | "removed";
  invited_by?: string | null;
  accepted_at?: string | null;
  joined_at: string;
};

type ConnectionInviteRow = {
  id: string;
  connection_id: string;
  code: string;
  created_by: string;
  accepted_by: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  max_uses: number;
  use_count: number;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type ConnectionInvitePreviewRow = {
  code: string;
  inviter_display_name: string;
  expires_at: string;
};

type ConnectionRequestRow = {
  connection_id: string;
  requester_id: string;
  requester_display_name: string;
  requested_at: string;
};

type DecisionRow = {
  id: string;
  connection_id: string;
  created_by: string;
  assigned_to: string;
  note: string | null;
  status: "pending" | "answered";
  created_at: string;
  updated_at: string;
  answered_at: string | null;
};

type DecisionOptionRow = {
  id: string;
  decision_id: string;
  label: string;
  title: string | null;
  image_url: string | null;
  sort_order: number;
};

type DecisionResponseRow = {
  id: string;
  decision_id: string;
  responder_id: string;
  selected_option_id: string | null;
  response_type: ResponseType;
  comment: string | null;
  created_at: string;
};

type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: string | null;
};

function toProfile(row: ProfileRow, connectionDisplayName?: string | null): Profile {
  return {
    id: row.id,
    displayName: connectionDisplayName?.trim() || row.display_name,
    profileDisplayName: row.display_name,
    connectionDisplayName: connectionDisplayName ?? null,
    age: row.age ?? null,
    gender: row.gender ?? null,
    avatarUrl: row.avatar_url,
  };
}

function toConnection(row: ConnectionRow, activeInvite?: ConnectionInviteRow): Connection {
  const subscriptionStatus = row.subscription_status ?? "inactive";
  return {
    id: row.id,
    inviteCode: activeInvite?.code ?? "",
    inviteExpiresAt: activeInvite?.expires_at ?? null,
    createdBy: row.created_by,
    billingOwnerUserId: row.billing_owner_user_id ?? null,
    subscriptionStatus,
    plan: row.plan ?? "free",
    premiumEnabled: subscriptionStatus === "active" || subscriptionStatus === "trialing",
    subscriptionCurrentPeriodEnd: row.subscription_current_period_end ?? null,
    createdAt: row.created_at,
  };
}

function toConnectionInvitePreview(row: ConnectionInvitePreviewRow): ConnectionInvitePreview {
  return {
    code: row.code,
    inviterDisplayName: row.inviter_display_name,
    expiresAt: row.expires_at,
  };
}

function toConnectionRequest(row: ConnectionRequestRow): ConnectionRequest {
  return {
    connectionId: row.connection_id,
    requesterId: row.requester_id,
    requesterDisplayName: row.requester_display_name,
    requestedAt: row.requested_at,
  };
}

function toDecision(
  row: DecisionRow,
  options: DecisionOptionRow[],
  responses: DecisionResponseRow[],
): Decision {
  const response = responses.find((item) => item.decision_id === row.id) ?? null;
  const mappedOptions = options.filter((option) => option.decision_id === row.id).map(toOption);
  return {
    id: row.id,
    connectionId: row.connection_id,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    title: makeDecisionTitle(mappedOptions),
    note: row.note,
    status: response ? "answered" : row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    answeredAt: row.answered_at ?? response?.created_at ?? null,
    options: mappedOptions,
    response: response ? toResponse(response) : null,
  };
}

function toOption(row: DecisionOptionRow): DecisionOption {
  return {
    id: row.id,
    decisionId: row.decision_id,
    label: row.label,
    title: row.title,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
  };
}

function toResponse(row: DecisionResponseRow): DecisionResponse {
  return {
    id: row.id,
    decisionId: row.decision_id,
    responderId: row.responder_id,
    selectedOptionId: row.selected_option_id,
    responseType: row.response_type,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

function makeDecisionTitle(options: DecisionOption[]) {
  const names = options.map((option) => option.title?.trim()).filter(Boolean);
  if (names.length >= 2) {
    return `${names[0]} or ${names[1]}?`;
  }
  if (names.length === 1) {
    return "Choose between these";
  }
  return "Help me choose";
}

function normalizeInviteCode(inviteCode: string) {
  return inviteCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

async function sendChoicePushNotifications(tokens: string[], senderName: string, decision: Decision) {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return;
  }

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        uniqueTokens.map((token) => ({
          to: token,
          sound: "default",
          title: "Just Choose",
          body: `${senderName} needs you to choose`,
          data: {
            decisionId: decision.id,
            screen: "AnswerDecision",
          },
        })),
      ),
    });
  } catch {
    // Sending a push should never prevent the choice from being created.
  }
}
