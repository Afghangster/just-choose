import { create } from "zustand";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from "react-native";

import {
  appRepository,
  type ConnectionInvitePreview,
  type RemoteAppState,
  type RemoteDecisionInput,
  type RemoteResponseInput,
} from "../services/supabaseRepository";
import { registerForPushNotifications } from "../services/notifications";
import type { Connection, ConnectionRequest, ConnectionSummary, Decision, DecisionResponse, Gender, Profile } from "../types/domain";
type DraftOption = { title: string; imageUrl: string | null; imagePath: string | null };

type AppState = {
  draftNote: string;
  draftOptions: DraftOption[];
  setDraftNote: (note: string) => void;
  setDraftOptions: (options: DraftOption[] | ((prev: DraftOption[]) => DraftOption[])) => void;
  clearDraft: () => void;
  authUserId: string | null;
  profile: Profile | null;
  connections: ConnectionSummary[];
  connectedProfile: Profile | null;
  connection: Connection | null;
  pendingConnectionRequests: ConnectionRequest[];
  decisions: Decision[];
  connectionPreview: ConnectionInvitePreview | null;
  pendingInviteCode: string | null;
  remoteStatus: "idle" | "loading" | "ready" | "error";
  remoteError: string | null;
  savedDecisionIds: string[];
  dismissedDecisionIds: string[];
  loadSavedDecisions: () => Promise<void>;
  toggleSavedDecision: (decisionId: string) => Promise<void>;
  loadDismissedDecisions: () => Promise<void>;
  dismissDecision: (decisionId: string) => Promise<void>;
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
  deleteRemoteDecision: (decisionId: string) => Promise<void>;
  answerRemoteDecision: (decisionId: string, response: RemoteResponseInput) => Promise<DecisionResponse>;
  registerCurrentDeviceForPush: () => Promise<boolean>;
  refreshRemoteState: () => Promise<RemoteAppState>;
  updateConnectionAlias: (displayName: string, connectionId?: string, targetUserId?: string) => Promise<RemoteAppState>;
  leaveConnection: (connectionId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const makeId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export const useAppStore = create<AppState>((set, get) => ({
  authUserId: null,
  profile: null,
  connections: [],
  connectedProfile: null,
  connection: null,
  pendingConnectionRequests: [],
  decisions: [],
  connectionPreview: null,
  pendingInviteCode: null,
  remoteStatus: "idle",
  remoteError: null,
  savedDecisionIds: [],
  dismissedDecisionIds: [],
  draftNote: "",
  draftOptions: [
    { title: "", imageUrl: null, imagePath: null },
    { title: "", imageUrl: null, imagePath: null },
  ],

  setDraftNote: (note) => set({ draftNote: note }),
  setDraftOptions: (options) =>
    set((state) => ({
      draftOptions: typeof options === "function" ? options(state.draftOptions) : options,
    })),
  clearDraft: () =>
    set({
      draftNote: "",
      draftOptions: [
        { title: "", imageUrl: null, imagePath: null },
        { title: "", imageUrl: null, imagePath: null },
      ],
    }),

  setAuthUser: (userId) => set({ authUserId: userId }),

  applyRemoteState: (remoteState) => {
    set({
      authUserId: remoteState.authUserId,
      profile: remoteState.profile,
      connections: remoteState.connections,
      connectedProfile: remoteState.connectedProfile,
      connection: remoteState.connection,
      pendingConnectionRequests: remoteState.pendingConnectionRequests,
      decisions: remoteState.decisions,
      connectionPreview: null,
      pendingInviteCode: remoteState.connections.some((item) => item.connectedProfile) ? null : get().pendingInviteCode,
      remoteStatus: "ready",
      remoteError: null,
    });
  },

  hydrateFromRemote: async () => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      const remoteState = await appRepository.loadCurrentUserAppState();
      get().applyRemoteState(remoteState);
      await get().loadSavedDecisions();
      await get().loadDismissedDecisions();
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

  deleteRemoteDecision: async (decisionId) => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      await appRepository.deleteDecision(decisionId);
      set((state) => ({
        decisions: state.decisions.filter((item) => item.id !== decisionId),
        remoteStatus: "ready",
        remoteError: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel choice.";
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
      return false;
    }
    const token = await registerForPushNotifications();
    if (token) {
      await appRepository.savePushToken(profile.id, token, Platform.OS);
      return true;
    }
    return false;
  },

  refreshRemoteState: async () => get().hydrateFromRemote(),

  updateConnectionAlias: async (displayName, connectionId, targetUserId) => {
    const selectedConnection =
      (connectionId
        ? get().connections.find((item) => item.connection.id === connectionId)
        : get().connections.find((item) => item.connection.id === get().connection?.id)) ?? null;
    const connection = selectedConnection?.connection ?? get().connection;
    const connectedProfile =
      (targetUserId && selectedConnection?.connectedProfile?.id === targetUserId
        ? selectedConnection.connectedProfile
        : selectedConnection?.connectedProfile) ?? get().connectedProfile;
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

  leaveConnection: async (connectionId) => {
    const connection =
      (connectionId ? get().connections.find((item) => item.connection.id === connectionId)?.connection : null) ??
      get().connection;
    set({ remoteStatus: "loading", remoteError: null });
    try {
      if (connection) {
        await appRepository.stopConnection(connection.id);
      }
      const remainingConnections = get().connections.filter((item) => item.connection.id !== connection?.id);
      const nextConnection = remainingConnections.find((item) => item.connectedProfile) ?? remainingConnections[0] ?? null;
      const removedConnectionId = connection?.id ?? null;
      set({
        connections: remainingConnections,
        connection: nextConnection?.connection ?? null,
        connectedProfile: nextConnection?.connectedProfile ?? null,
        pendingConnectionRequests: removedConnectionId
          ? get().pendingConnectionRequests.filter((request) => request.connectionId !== removedConnectionId)
          : get().pendingConnectionRequests,
        decisions: removedConnectionId
          ? get().decisions.filter((decision) => decision.connectionId !== removedConnectionId)
          : get().decisions,
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
        connections: [],
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

  deleteAccount: async () => {
    set({ remoteStatus: "loading", remoteError: null });
    try {
      await appRepository.deleteAccount();
      await appRepository.signOut();
      set({
        authUserId: null,
        profile: null,
        connections: [],
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
      const message = error instanceof Error ? error.message : "Unable to delete account.";
      set({ remoteStatus: "error", remoteError: message });
      throw error;
    }
  },

  loadSavedDecisions: async () => {
    try {
      const stored = await AsyncStorage.getItem("saved_decisions");
      if (stored) {
        set({ savedDecisionIds: JSON.parse(stored) });
      }
    } catch (error) {
      console.warn("Failed to load saved decisions", error);
    }
  },

  toggleSavedDecision: async (decisionId) => {
    const current = get().savedDecisionIds;
    const isSaved = current.includes(decisionId);
    const next = isSaved ? current.filter((id) => id !== decisionId) : [...current, decisionId];
    set({ savedDecisionIds: next });
    try {
      await AsyncStorage.setItem("saved_decisions", JSON.stringify(next));
    } catch (error) {
      console.warn("Failed to save decisions", error);
    }
  },

  loadDismissedDecisions: async () => {
    try {
      const stored = await AsyncStorage.getItem("dismissed_decisions");
      if (stored) {
        set({ dismissedDecisionIds: JSON.parse(stored) });
      }
    } catch (error) {
      console.warn("Failed to load dismissed decisions", error);
    }
  },

  dismissDecision: async (decisionId) => {
    const current = get().dismissedDecisionIds;
    if (current.includes(decisionId)) return;
    const next = [...current, decisionId];
    set({ dismissedDecisionIds: next });
    try {
      await AsyncStorage.setItem("dismissed_decisions", JSON.stringify(next));
    } catch (error) {
      console.warn("Failed to dismiss decision", error);
    }
  },
}));

