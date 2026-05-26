import { create } from "zustand";

import {
  appRepository,
  type ConnectionInvitePreview,
  type RemoteAppState,
  type RemoteDecisionInput,
  type RemoteResponseInput,
} from "../services/supabaseRepository";
import { registerForPushNotifications } from "../services/notifications";
import type { Connection, ConnectionRequest, Decision, DecisionResponse, Gender, Profile } from "../types/domain";

type AppState = {
  authUserId: string | null;
  profile: Profile | null;
  connectedProfile: Profile | null;
  connection: Connection | null;
  pendingConnectionRequests: ConnectionRequest[];
  decisions: Decision[];
  connectionPreview: ConnectionInvitePreview | null;
  pendingInviteCode: string | null;
  remoteStatus: "idle" | "loading" | "ready" | "error";
  remoteError: string | null;
  setAuthUser: (userId: string) => void;
  applyRemoteState: (remoteState: RemoteAppState) => void;
  hydrateFromRemote: () => Promise<RemoteAppState>;
  createProfile: (input: { displayName: string; age: number; gender: Gender }) => Profile;
  createRemoteConnectionInvite: () => Promise<RemoteAppState>;
  previewRemoteConnectionInvite: (inviteCode: string) => Promise<ConnectionInvitePreview>;
  acceptRemoteConnectionInvite: (inviteCode: string) => Promise<RemoteAppState>;
  joinRemoteConnection: (inviteCode: string) => Promise<RemoteAppState>;
  approveConnectionRequest: (requesterId: string) => Promise<RemoteAppState>;
  rejectConnectionRequest: (requesterId: string) => Promise<RemoteAppState>;
  setPendingInviteCode: (inviteCode: string | null) => void;
  createRemoteDecision: (input: RemoteDecisionInput) => Promise<Decision>;
  answerRemoteDecision: (decisionId: string, response: RemoteResponseInput) => Promise<DecisionResponse>;
  registerCurrentDeviceForPush: () => Promise<void>;
  refreshRemoteState: () => Promise<RemoteAppState>;
  updateConnectionDisplayName: (displayName: string) => Promise<RemoteAppState>;
  leaveConnection: () => Promise<void>;
  signOut: () => Promise<void>;
};

const makeId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export const useAppStore = create<AppState>((set, get) => ({
  authUserId: null,
  profile: null,
  connectedProfile: null,
  connection: null,
  pendingConnectionRequests: [],
  decisions: [],
  connectionPreview: null,
  pendingInviteCode: null,
  remoteStatus: "idle",
  remoteError: null,

  setAuthUser: (userId) => set({ authUserId: userId }),

  applyRemoteState: (remoteState) => {
    set({
      authUserId: remoteState.authUserId,
      profile: remoteState.profile,
      connectedProfile: remoteState.connectedProfile,
      connection: remoteState.connection,
      pendingConnectionRequests: remoteState.pendingConnectionRequests,
      decisions: remoteState.decisions,
      connectionPreview: null,
      pendingInviteCode: remoteState.connection && remoteState.connectedProfile ? null : get().pendingInviteCode,
      remoteStatus: "ready",
      remoteError: null,
    });
  },

  hydrateFromRemote: async () => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.loadCurrentUserAppState();
      get().applyRemoteState(remoteState);
      return remoteState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load account.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  createProfile: ({ displayName, age, gender }) => {
    const profile: Profile = {
      id: get().authUserId ?? makeId("user"),
      displayName: displayName.trim() || "You",
      profileDisplayName: displayName.trim() || "You",
      age,
      gender,
      avatarUrl: null,
    };
    set({ profile, authUserId: profile.id });
    return profile;
  },

  createRemoteConnectionInvite: async () => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.createConnectionInvite();
      get().applyRemoteState(remoteState);
      return remoteState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create invite.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  previewRemoteConnectionInvite: async (inviteCode) => {
    set({ remoteStatus: "loading", remoteError: null, connectionPreview: null });
    try {
      const preview = await appRepository.previewConnectionInvite(inviteCode);
      set({ connectionPreview: preview, remoteStatus: "ready", remoteError: null });
      return preview;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview invite.";
      set({ remoteStatus: "error", remoteError: message, connectionPreview: null });
      throw error;
    }
  },

  acceptRemoteConnectionInvite: async (inviteCode) => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.acceptConnectionInvite(inviteCode);
      get().applyRemoteState(remoteState);
      return remoteState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to accept invite.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  joinRemoteConnection: async (inviteCode) => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.acceptConnectionInvite(inviteCode);
      get().applyRemoteState(remoteState);
      return remoteState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to join connection.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  setPendingInviteCode: (inviteCode) => set({ pendingInviteCode: inviteCode }),

  approveConnectionRequest: async (requesterId) => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.approveConnectionRequest(requesterId);
      get().applyRemoteState(remoteState);
      return remoteState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve connection.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  rejectConnectionRequest: async (requesterId) => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.rejectConnectionRequest(requesterId);
      get().applyRemoteState(remoteState);
      return remoteState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reject connection.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  createRemoteDecision: async (input) => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const decision = await appRepository.createDecisionWithOptions(input);
      set((state) => ({
        decisions: [decision, ...state.decisions.filter((item) => item.id !== decision.id)],
        remoteStatus: "ready",
        remoteError: null,
      }));
      return decision;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create choice.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  answerRemoteDecision: async (decisionId, responseInput) => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const response = await appRepository.answerDecision(decisionId, responseInput);
      const remoteState = await appRepository.loadCurrentUserAppState();
      get().applyRemoteState(remoteState);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to answer choice.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  registerCurrentDeviceForPush: async () => {
    const profile = get().profile;
    if (!profile) {
      return;
    }
    const token = await registerForPushNotifications();
    if (token) {
      await appRepository.savePushToken(profile.id, token);
    }
  },

  refreshRemoteState: async () => get().hydrateFromRemote(),

  updateConnectionDisplayName: async (displayName) => {
    const connection = get().connection;
    const connectedProfile = get().connectedProfile;
    if (!connection || !connectedProfile) {
      throw new Error("Create a connection first.");
    }
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.updateConnectionDisplayName({
        connectionId: connection.id,
        targetUserId: connectedProfile.id,
        displayName,
      });
      get().applyRemoteState(remoteState);
      return remoteState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update connection.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  leaveConnection: async () => {
    const connection = get().connection;
    set({ remoteStatus: "loading", remoteError: null });
    try {
      if (connection) {
        await appRepository.stopConnection(connection.id);
      }
      set({
        connection: null,
        connectedProfile: null,
        pendingConnectionRequests: [],
        decisions: [],
        connectionPreview: null,
        pendingInviteCode: null,
        remoteStatus: "ready",
        remoteError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to stop connection.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  signOut: async () => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      await appRepository.signOut();
      set({
        authUserId: null,
        profile: null,
        connectedProfile: null,
        connection: null,
        pendingConnectionRequests: [],
        decisions: [],
        connectionPreview: null,
        pendingInviteCode: null,
        remoteStatus: "ready",
        remoteError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign out.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },
}));
