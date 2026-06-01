import type { AppRepository, RemoteAppState } from "../../services/supabaseRepository";
import { setAppRepositoryForTesting } from "../../services/supabaseRepository";
import { useAppStore } from "../appStore";

const lisaId = "00000000-0000-4000-8000-000000000001";
const noahId = "00000000-0000-4000-8000-000000000002";
const charlieId = "00000000-0000-4000-8000-000000000003";
const connectionId = "00000000-0000-4000-8000-000000000010";
const secondConnectionId = "00000000-0000-4000-8000-000000000020";
const decisionId = "00000000-0000-4000-8000-000000000030";
const secondDecisionId = "00000000-0000-4000-8000-000000000050";

describe("useAppStore simplified remote flow", () => {
  beforeEach(() => {
    useAppStore.setState({
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
    });
  });

  test("previews then accepts a connection invite", async () => {
    const repository = fakeRepository(remoteState());
    setAppRepositoryForTesting(repository);

    const preview = await useAppStore.getState().previewRemoteConnectionInvite("testduo");
    expect(preview.inviterDisplayName).toBe("Lisa");
    expect(repository.previewConnectionInvite).toHaveBeenCalledWith("testduo");
    expect(useAppStore.getState().connection).toBeNull();

    await useAppStore.getState().acceptRemoteConnectionInvite("testduo");
    expect(repository.acceptConnectionInvite).toHaveBeenCalledWith("testduo");
    expect(useAppStore.getState().connection?.id).toBe(connectionId);
    expect(useAppStore.getState().connectionPreview).toBeNull();
  });

  test("hydrates login state from the repository", async () => {
    setAppRepositoryForTesting(fakeRepository(remoteState()));

    await useAppStore.getState().hydrateFromRemote();

    expect(useAppStore.getState().profile?.id).toBe(lisaId);
    expect(useAppStore.getState().connection?.id).toBe(connectionId);
    expect(useAppStore.getState().connectedProfile?.id).toBe(noahId);
    expect(useAppStore.getState().remoteStatus).toBe("ready");
  });

  test("creates a decision from just options and note", async () => {
    const repository = fakeRepository(remoteState());
    setAppRepositoryForTesting(repository);

    const decision = await useAppStore.getState().createRemoteDecision({
      note: "Fits the alcove",
      options: [
        { label: "A", title: "Tall lamp" },
        { label: "B", title: "Small lamp" },
      ],
    });

    expect(decision.id).toBe(decisionId);
    expect(repository.createDecisionWithOptions).toHaveBeenCalledWith({
      note: "Fits the alcove",
      options: [
        { label: "A", title: "Tall lamp" },
        { label: "B", title: "Small lamp" },
      ],
    });
  });

  test("remote answer refreshes persisted state", async () => {
    const answered = remoteState({
      response: {
        id: "00000000-0000-4000-8000-000000000040",
        decisionId,
        responderId: noahId,
        selectedOptionId: "00000000-0000-4000-8000-000000000032",
        responseType: "selected_option",
        comment: "This one",
        createdAt: "2026-05-25T09:01:00.000Z",
      },
    });
    setAppRepositoryForTesting(fakeRepository(answered));

    await useAppStore.getState().answerRemoteDecision(decisionId, {
      responseType: "selected_option",
      selectedOptionId: "00000000-0000-4000-8000-000000000032",
    });

    expect(useAppStore.getState().decisions[0].status).toBe("answered");
    expect(useAppStore.getState().decisions[0].response?.comment).toBe("This one");
  });

  test("leaving one connection keeps the other connection state", async () => {
    const state = remoteState();
    const multiConnectionState: RemoteAppState = {
      ...state,
      connections: [
        ...state.connections,
        {
          connection: {
            ...state.connection!,
            id: secondConnectionId,
            inviteCode: "SECOND",
          },
          connectedProfile: { id: charlieId, displayName: "Charlie", avatarUrl: null },
        },
      ],
      pendingConnectionRequests: [
        {
          connectionId,
          requesterId: "00000000-0000-4000-8000-000000000091",
          requesterDisplayName: "Pending Noah",
          requestedAt: "2026-05-25T09:00:00.000Z",
        },
        {
          connectionId: secondConnectionId,
          requesterId: "00000000-0000-4000-8000-000000000092",
          requesterDisplayName: "Pending Charlie",
          requestedAt: "2026-05-25T09:00:00.000Z",
        },
      ],
      decisions: [
        state.decisions[0],
        {
          ...state.decisions[0],
          id: secondDecisionId,
          connectionId: secondConnectionId,
          assignedTo: charlieId,
          title: "Coffee or Tea?",
        },
      ],
    };
    useAppStore.setState(multiConnectionState);
    const repository = fakeRepository(multiConnectionState);
    setAppRepositoryForTesting(repository);

    await useAppStore.getState().leaveConnection(connectionId);

    expect(repository.stopConnection).toHaveBeenCalledWith(connectionId);
    expect(useAppStore.getState().connections.map((item) => item.connection.id)).toEqual([secondConnectionId]);
    expect(useAppStore.getState().connection?.id).toBe(secondConnectionId);
    expect(useAppStore.getState().connectedProfile?.id).toBe(charlieId);
    expect(useAppStore.getState().decisions.map((decision) => decision.id)).toEqual([secondDecisionId]);
    expect(useAppStore.getState().pendingConnectionRequests.map((request) => request.connectionId)).toEqual([
      secondConnectionId,
    ]);
  });
});

function remoteState(overrides: Partial<RemoteAppState["decisions"][number]> = {}): RemoteAppState {
  return {
    authUserId: lisaId,
    profile: { id: lisaId, displayName: "Lisa", avatarUrl: null },
    connectedProfile: { id: noahId, displayName: "Noah", avatarUrl: null },
    connection: {
      id: connectionId,
      inviteCode: "TESTDUO",
      inviteExpiresAt: null,
      createdBy: lisaId,
      billingOwnerUserId: lisaId,
      subscriptionStatus: "active",
      plan: "connection",
      premiumEnabled: true,
      subscriptionCurrentPeriodEnd: null,
      createdAt: "2026-05-25T09:00:00.000Z",
    },
    connections: [
      {
        connection: {
          id: connectionId,
          inviteCode: "TESTDUO",
          inviteExpiresAt: null,
          createdBy: lisaId,
          billingOwnerUserId: lisaId,
          subscriptionStatus: "active",
          plan: "connection",
          premiumEnabled: true,
          subscriptionCurrentPeriodEnd: null,
          createdAt: "2026-05-25T09:00:00.000Z",
        },
        connectedProfile: { id: noahId, displayName: "Noah", avatarUrl: null },
      },
    ],
    pendingConnectionRequests: [],
    decisions: [
      {
        id: decisionId,
        connectionId,
        createdBy: lisaId,
        assignedTo: noahId,
        title: "Green sofa or Blue sofa?",
        note: null,
        status: overrides.response ? "answered" : "pending",
        createdAt: "2026-05-25T09:00:00.000Z",
        updatedAt: "2026-05-25T09:00:00.000Z",
        answeredAt: overrides.response?.createdAt ?? null,
        options: [
          {
            id: "00000000-0000-4000-8000-000000000031",
            decisionId,
            label: "A",
            title: "Green sofa",
            sortOrder: 0,
          },
          {
            id: "00000000-0000-4000-8000-000000000032",
            decisionId,
            label: "B",
            title: "Blue sofa",
            sortOrder: 1,
          },
        ],
        response: null,
        ...overrides,
      },
    ],
  };
}

function fakeRepository(state: RemoteAppState): AppRepository {
  const response = state.decisions[0].response ?? {
    id: "00000000-0000-4000-8000-000000000040",
    decisionId,
    responderId: noahId,
    selectedOptionId: null,
    responseType: "cant_choose" as const,
    comment: null,
    createdAt: "2026-05-25T09:01:00.000Z",
  };

  return {
    signInWithEmail: jest.fn(async () => ({ userId: state.authUserId! })),
    signUpWithEmail: jest.fn(async () => ({
      userId: state.authUserId!,
      needsEmailConfirmation: false,
      email: "lisa@example.com",
    })),
    resendSignupConfirmation: jest.fn(async () => undefined),
    startAppleOAuthSignIn: jest.fn(async () => ({ url: "https://example.com/auth" })),
    startGoogleSignIn: jest.fn(async () => ({ url: "https://example.com/auth" })),
    completeOAuthSignIn: jest.fn(async () => ({ userId: state.authUserId! })),
    signInWithAppleIdentityToken: jest.fn(async () => ({ userId: state.authUserId! })),
    signInWithPhoneOtp: jest.fn(async () => undefined),
    verifyPhoneOtp: jest.fn(async () => ({ userId: state.authUserId! })),
    updatePassword: jest.fn(async () => undefined),
    loadCurrentUserAppState: jest.fn(async () => state),
    upsertProfile: jest.fn(async () => state),
    createConnectionInvite: jest.fn(async () => state),
    previewConnectionInvite: jest.fn(async () => ({
      code: "TESTDUO",
      inviterDisplayName: "Lisa",
      expiresAt: "2999-05-25T10:00:00.000Z",
    })),
    acceptConnectionInvite: jest.fn(async () => state),
    joinConnectionByInviteCode: jest.fn(async () => state),
    approveConnectionRequest: jest.fn(async () => state),
    rejectConnectionRequest: jest.fn(async () => state),
    createDecisionWithOptions: jest.fn(async () => state.decisions[0]),
    answerDecision: jest.fn(async () => response),
    savePushToken: jest.fn(async () => undefined),
    updateConnectionDisplayName: jest.fn(async () => state),
    stopConnection: jest.fn(async () => ({ ...state, connections: [], connection: null, connectedProfile: null, decisions: [] })),
    deleteDecision: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    deleteAccount: jest.fn(async () => undefined),
  };
}
