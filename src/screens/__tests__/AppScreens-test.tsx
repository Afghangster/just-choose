import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import {
  AnswerDecisionScreen,
  AuthScreen,
  CreateDecisionScreen,
  DecisionDetailScreen,
  DecisionResultScreen,
  HistoryScreen,
  HomeScreen,
  JoinConnectionScreen,
} from "../AppScreens";
import { setAppRepositoryForTesting, type AppRepository, type RemoteAppState } from "../../services/supabaseRepository";
import { useAppStore } from "../../store/appStore";

const aliceId = "00000000-0000-4000-8000-000000000001";
const bobId = "00000000-0000-4000-8000-000000000002";
const connectionId = "00000000-0000-4000-8000-000000000010";
const decisionId = "00000000-0000-4000-8000-000000000030";
const optionBId = "00000000-0000-4000-8000-000000000032";

describe("simplified choice screens", () => {
  beforeEach(() => {
    const state = remoteState();
    useAppStore.setState({
      authUserId: state.authUserId,
      profile: state.profile,
      connectedProfile: state.connectedProfile,
      connection: state.connection,
      pendingConnectionRequests: state.pendingConnectionRequests,
      decisions: state.decisions,
      connectionPreview: null,
      pendingInviteCode: null,
      remoteStatus: "ready",
      remoteError: null,
    });
  });

  test("home renders generated decision title and can refresh", async () => {
    const repository = fakeRepository(remoteState());
    setAppRepositoryForTesting(repository);

    render(<HomeScreen navigation={mockNavigation()} route={mockRoute("Home")} />);

    expect(screen.getByText("HI ALICE")).toBeTruthy();
    expect(screen.getByText("Green sofa or Blue sofa?")).toBeTruthy();
    
    const scrollView = screen.getByTestId("screen-scroll-view");
    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(repository.loadCurrentUserAppState).toHaveBeenCalled());
  });

  test("home footer opens history between home and create", () => {
    setAppRepositoryForTesting(fakeRepository(remoteState()));
    const navigation = mockNavigation();

    render(<HomeScreen navigation={navigation} route={mockRoute("Home")} />);

    fireEvent.press(screen.getByLabelText("History"));

    expect(navigation.navigate).toHaveBeenCalledWith("History");
  });

  test("home only exposes settings through the footer", () => {
    setAppRepositoryForTesting(fakeRepository(remoteState()));

    render(<HomeScreen navigation={mockNavigation()} route={mockRoute("Home")} />);

    expect(screen.queryByText("Settings")).toBeNull();
    expect(screen.getByLabelText("Settings")).toBeTruthy();
  });

  test("home still shows the creator flow without a connection", () => {
    const noConnection = {
      ...remoteState(),
      connectedProfile: null,
      connection: null,
      pendingConnectionRequests: [],
      decisions: [],
    };
    useAppStore.setState(noConnection);
    setAppRepositoryForTesting(fakeRepository(noConnection));
    const navigation = mockNavigation();

    render(<HomeScreen navigation={navigation} route={mockRoute("Home")} />);

    expect(screen.getByText("HI ALICE")).toBeTruthy();
    expect(screen.getByLabelText("Create new decision")).toBeTruthy();
    expect(screen.getByText("No connection yet")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Create new decision"));

    expect(navigation.navigate).toHaveBeenCalledWith("CreateDecision");
  });

  test("history renders answered decisions", () => {
    const answered = remoteState({
      status: "answered",
      response: {
        id: "00000000-0000-4000-8000-000000000040",
        decisionId,
        responderId: bobId,
        selectedOptionId: optionBId,
        responseType: "selected_option",
        comment: "This one",
        createdAt: "2026-05-25T09:01:00.000Z",
      },
      answeredAt: "2026-05-25T09:01:00.000Z",
    });
    useAppStore.setState({ decisions: answered.decisions });
    setAppRepositoryForTesting(fakeRepository(answered));

    render(<HistoryScreen navigation={mockNavigation()} route={mockRoute("History")} />);

    expect(screen.getByText("HISTORY")).toBeTruthy();
    expect(screen.getByText("Bob chose Blue sofa")).toBeTruthy();
  });

  test("create choice sends only option names and an optional note", async () => {
    const repository = fakeRepository(remoteState());
    setAppRepositoryForTesting(repository);
    const navigation = mockNavigation();

    render(<CreateDecisionScreen navigation={navigation} route={mockRoute("CreateDecision")} />);

    fireEvent.changeText(screen.getByPlaceholderText("Sushi 🍣"), "Black chair");
    fireEvent.changeText(screen.getByPlaceholderText("Thai 🍜"), "White chair");
    fireEvent.changeText(screen.getByPlaceholderText("Where should we eat tonight?"), "Need it today");
    fireEvent.press(screen.getByText("JUST CHOOSE"));

    await waitFor(() =>
      expect(repository.createDecisionWithOptions).toHaveBeenCalledWith({
        note: "Need it today",
        options: [
          { label: "A", title: "Black chair", imageUrl: null, imagePath: null },
          { label: "B", title: "White chair", imageUrl: null, imagePath: null },
        ],
      }),
    );
    expect(navigation.replace).toHaveBeenCalledWith("DecisionDetail", { decisionId });
  });

  test("create choice asks for a connection only when submitting", async () => {
    const noConnection = {
      ...remoteState(),
      connectedProfile: null,
      connection: null,
      pendingConnectionRequests: [],
      decisions: [],
    };
    useAppStore.setState(noConnection);
    const repository = fakeRepository(noConnection);
    setAppRepositoryForTesting(repository);
    const navigation = mockNavigation();
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

    render(<CreateDecisionScreen navigation={navigation} route={mockRoute("CreateDecision")} />);

    fireEvent.changeText(screen.getByPlaceholderText("Sushi 🍣"), "Black chair");
    fireEvent.changeText(screen.getByPlaceholderText("Thai 🍜"), "White chair");
    fireEvent.changeText(screen.getByPlaceholderText("Where should we eat tonight?"), "Need it today");
    fireEvent.press(screen.getByText("JUST CHOOSE"));

    expect(repository.createDecisionWithOptions).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Connection needed",
      "Set up a connection before submitting. Your draft will stay here while you do that.",
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    buttons.find((button) => button.text === "Set up connection")?.onPress?.();

    expect(navigation.navigate).toHaveBeenCalledWith("ConnectionInvite");
    expect(screen.getByPlaceholderText("Sushi 🍣").props.value).toBe("Black chair");
    expect(screen.getByPlaceholderText("Thai 🍜").props.value).toBe("White chair");
    expect(screen.getByPlaceholderText("Where should we eat tonight?").props.value).toBe("Need it today");

    alertSpy.mockRestore();
  });

  test("creator cannot answer their own pending choice", () => {
    setAppRepositoryForTesting(fakeRepository(remoteState()));

    render(
      <DecisionDetailScreen
        navigation={mockNavigation()}
        route={mockRoute("DecisionDetail", { decisionId })}
      />,
    );

    expect(screen.getByText("Waiting for Bob")).toBeTruthy();
    expect(screen.queryByText("Just choose")).toBeNull();
  });

  test("connected profile can answer and result shows the persisted answer", async () => {
    const answered = remoteState({
      status: "answered",
      response: {
        id: "00000000-0000-4000-8000-000000000040",
        decisionId,
        responderId: bobId,
        selectedOptionId: optionBId,
        responseType: "selected_option",
        comment: "This one",
        createdAt: "2026-05-25T09:01:00.000Z",
      },
      answeredAt: "2026-05-25T09:01:00.000Z",
    });
    const repository = fakeRepository(answered);
    setAppRepositoryForTesting(repository);
    const navigation = mockNavigation();

    render(
      <AnswerDecisionScreen
        navigation={navigation}
        route={mockRoute("AnswerDecision", { decisionId })}
      />,
    );

    fireEvent.press(screen.getByText("Blue sofa"));
    fireEvent.changeText(screen.getByPlaceholderText("Optional"), "This one");
    fireEvent.press(screen.getAllByText("JUST CHOOSE").at(-1)!);

    await waitFor(() =>
      expect(repository.answerDecision).toHaveBeenCalledWith(
        decisionId,
        expect.objectContaining({ selectedOptionId: optionBId, comment: "This one" }),
      ),
    );

    render(
      <DecisionResultScreen
        navigation={mockNavigation()}
        route={mockRoute("DecisionResult", { decisionId })}
      />,
    );
    expect(screen.getByText(/This one/)).toBeTruthy();
  });

  test("join screen previews before accepting connection", async () => {
    useAppStore.setState({
      authUserId: bobId,
      profile: { id: bobId, displayName: "Bob", avatarUrl: null },
      connectedProfile: null,
      connection: null,
      pendingConnectionRequests: [],
      decisions: [],
      connectionPreview: null,
      pendingInviteCode: null,
      remoteStatus: "ready",
      remoteError: null,
    });
    const repository = fakeRepository(remoteState());
    setAppRepositoryForTesting(repository);
    const navigation = mockNavigation();

    render(<JoinConnectionScreen navigation={navigation} route={mockRoute("JoinConnection")} />);

    fireEvent.changeText(screen.getByPlaceholderText("ABCD-EFGH-IJKL"), "testduo");
    fireEvent.press(screen.getByText("Preview connection"));

    await waitFor(() => expect(screen.getByText("Connect with Alice?")).toBeTruthy());
    expect(repository.acceptConnectionInvite).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByText("Accept connection").at(-1)!);

    await waitFor(() => expect(repository.acceptConnectionInvite).toHaveBeenCalledWith("TESTDUO"));
    expect(navigation.replace).toHaveBeenCalledWith("Home");
  });

  test("invalid invite does not navigate home", async () => {
    useAppStore.setState({
      authUserId: bobId,
      profile: { id: bobId, displayName: "Bob", avatarUrl: null },
      connectedProfile: null,
      connection: null,
      pendingConnectionRequests: [],
      decisions: [],
      connectionPreview: null,
      pendingInviteCode: null,
      remoteStatus: "ready",
      remoteError: null,
    });
    const repository = {
      ...fakeRepository(remoteState()),
      previewConnectionInvite: jest.fn(async () => {
        throw new Error("Invite code not found or expired.");
      }),
    };
    setAppRepositoryForTesting(repository);
    const navigation = mockNavigation();

    render(<JoinConnectionScreen navigation={navigation} route={mockRoute("JoinConnection")} />);

    fireEvent.changeText(screen.getByPlaceholderText("ABCD-EFGH-IJKL"), "expired");
    fireEvent.press(screen.getByText("Preview connection"));

    await waitFor(() => expect(screen.getByText("Invite code not found or expired.")).toBeTruthy());
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test("email signup opens profile creation without email confirmation", async () => {
    const repository = {
      ...fakeRepository(remoteState()),
      signUpWithEmail: jest.fn(async () => ({
        userId: "00000000-0000-4000-8000-000000000099",
        needsEmailConfirmation: false,
        email: "new@example.com",
      })),
      loadCurrentUserAppState: jest.fn(async () => ({
        ...remoteState(),
        profile: null,
        connectedProfile: null,
        connection: null,
        pendingConnectionRequests: [],
        decisions: [],
      })),
    };
    setAppRepositoryForTesting(repository);
    const navigation = mockNavigation();

    render(<AuthScreen navigation={navigation} route={mockRoute("Auth")} />);

    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "new@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Minimum 6 characters"), "mielad123");
    fireEvent.press(screen.getByText("Sign up with email"));

    await waitFor(() => expect(repository.signUpWithEmail).toHaveBeenCalledWith("new@example.com", "mielad123"));
    expect(navigation.navigate).toHaveBeenCalledWith("CreateProfile");
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
      inviteExpiresAt: "2999-05-25T10:00:00.000Z",
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
        status: "pending",
        createdAt: "2026-05-25T09:00:00.000Z",
        updatedAt: "2026-05-25T09:00:00.000Z",
        answeredAt: null,
        options: [
          {
            id: "00000000-0000-4000-8000-000000000031",
            decisionId,
            label: "A",
            title: "Green sofa",
            sortOrder: 0,
          },
          {
            id: optionBId,
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
  const fallbackDecision = remoteState().decisions[0];
  const decision = state.decisions[0] ?? fallbackDecision;
  const response = decision.response ?? {
    id: "00000000-0000-4000-8000-000000000040",
    decisionId,
    responderId: bobId,
    selectedOptionId: optionBId,
    responseType: "selected_option" as const,
    comment: "This one",
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
    startAppleOAuthSignIn: jest.fn(async () => ({ url: "https://example.com/auth" })),
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
    createDecisionWithOptions: jest.fn(async () => decision),
    answerDecision: jest.fn(async () => response),
    savePushToken: jest.fn(async () => undefined),
    updateConnectionDisplayName: jest.fn(async () => state),
    stopConnection: jest.fn(async () => ({ ...state, connection: null, connectedProfile: null, decisions: [] })),
    deleteDecision: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    deleteAccount: jest.fn(async () => undefined),
  };
}

function mockNavigation() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  } as any;
}

function mockRoute(name: string, params?: Record<string, string>) {
  return {
    key: name,
    name,
    params,
  } as any;
}
