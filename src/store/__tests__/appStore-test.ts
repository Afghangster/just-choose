import type { AppRepository, RemoteAppState } from "../../services/supabaseRepository";
import { setAppRepositoryForTesting } from "../../services/supabaseRepository";
import { useAppStore } from "../appStore";

const aliceId = "00000000-0000-4000-8000-000000000001";
const bobId = "00000000-0000-4000-8000-000000000002";
const connectionId = "00000000-0000-4000-8000-000000000010";
const decisionId = "00000000-0000-4000-8000-000000000030";

describe("useAppStore simplified remote flow", () => {
  beforeEach(() => {
    useAppStore.setState({
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
    });
  });

  test("previews then accepts a connection invite", async () => {
    const repository = fakeRepository(remoteState());
    setAppRepositoryForTesting(repository);

    const preview = await useAppStore.getState().previewRemoteConnectionInvite("testduo");
    expect(preview.inviterDisplayName).toBe("Alice");
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

    expect(useAppStore.getState().profile?.id).toBe(aliceId);
    expect(useAppStore.getState().connection?.id).toBe(connectionId);
    expect(useAppStore.getState().connectedProfile?.id).toBe(bobId);
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
        responderId: bobId,
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
});

function remoteState(overrides: Partial<RemoteAppState["decisions"][number]> = {}): RemoteAppState {
  return {
    authUserId: aliceId,
    profile: { id: aliceId, displayName: "Alice", avatarUrl: null },
    connectedProfile: { id: bobId, displayName: "Bob", avatarUrl: null },
    connection: {
      id: connectionId,
      inviteCode: "TESTDUO",
      inviteExpiresAt: null,
      createdBy: aliceId,
      billingOwnerUserId: aliceId,
      subscriptionStatus: "active",
      plan: "connection",
      premiumEnabled: true,
      subscriptionCurrentPeriodEnd: null,
      createdAt: "2026-05-25T09:00:00.000Z",
    },
    pendingConnectionRequests: [],
    decisions: [
      {
        id: decisionId,
        connectionId,
        createdBy: aliceId,
        assignedTo: bobId,
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
    responderId: bobId,
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
      email: "alice@example.com",
    })),
    resendSignupConfirmation: jest.fn(async () => undefined),
    startGoogleSignIn: jest.fn(async () => ({ url: "https://example.com/auth" })),
    completeOAuthSignIn: jest.fn(async () => ({ userId: state.authUserId! })),
    signInWithAppleIdentityToken: jest.fn(async () => ({ userId: state.authUserId! })),
    signInWithPhoneOtp: jest.fn(async () => undefined),
    verifyPhoneOtp: jest.fn(async () => ({ userId: state.authUserId! })),
    loadCurrentUserAppState: jest.fn(async () => state),
    upsertProfile: jest.fn(async () => state),
    createConnectionInvite: jest.fn(async () => state),
    previewConnectionInvite: jest.fn(async () => ({
      code: "TESTDUO",
      inviterDisplayName: "Alice",
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
    stopConnection: jest.fn(async () => ({ ...state, connection: null, connectedProfile: null, decisions: [] })),
    signOut: jest.fn(async () => undefined),
  };
}
