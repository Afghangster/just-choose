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
  MyPeopleScreen,
  ProfileScreen,
  SettingsScreen,
} from "../AppScreens";
import { setAppRepositoryForTesting, type AppRepository, type RemoteAppState } from "../../services/supabaseRepository";
import { useAppStore } from "../../store/appStore";

const lisaId = "00000000-0000-4000-8000-000000000001";
const noahId = "00000000-0000-4000-8000-000000000002";
const charlieId = "00000000-0000-4000-8000-000000000003";
const connectionId = "00000000-0000-4000-8000-000000000010";
const secondConnectionId = "00000000-0000-4000-8000-000000000011";
const expiredConnectionId = "00000000-0000-4000-8000-000000000012";
const decisionId = "00000000-0000-4000-8000-000000000030";
const optionBId = "00000000-0000-4000-8000-000000000032";

describe("simplified choice screens", () => {
  beforeEach(() => {
    const state = remoteState();
    useAppStore.setState({
      authUserId: state.authUserId,
      profile: state.profile,
      connections: state.connections,
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

    expect(screen.getByText("HI LISA")).toBeTruthy();
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

  test("settings opens profile editing", () => {
    setAppRepositoryForTesting(fakeRepository(remoteState()));
    const navigation = mockNavigation();

    render(<SettingsScreen navigation={navigation} route={mockRoute("Settings")} />);

    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("You show up as Lisa")).toBeTruthy();

    fireEvent.press(screen.getByText("Profile"));

    expect(navigation.navigate).toHaveBeenCalledWith("Profile");
  });

  test("settings opens my people", () => {
    setAppRepositoryForTesting(fakeRepository(remoteState()));
    const navigation = mockNavigation();

    render(<SettingsScreen navigation={navigation} route={mockRoute("Settings")} />);

    expect(screen.getByText("My people")).toBeTruthy();
    expect(screen.getByText("Invite, rename, or remove your person")).toBeTruthy();

    fireEvent.press(screen.getByText("My people"));

    expect(navigation.navigate).toHaveBeenCalledWith("MyPeople");
  });

  test("profile screen saves a renamed display name", async () => {
    const updatedState = {
      ...remoteState(),
      profile: {
        ...remoteState().profile!,
        displayName: "Alicia",
        profileDisplayName: "Alicia",
      },
    };
    const repository = fakeRepository(updatedState);
    const navigation = mockNavigation();
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    setAppRepositoryForTesting(repository);

    render(<ProfileScreen navigation={navigation} route={mockRoute("Profile")} />);

    fireEvent.changeText(screen.getByPlaceholderText("Mia"), "Alicia");
    fireEvent.press(screen.getByText("Save profile"));

    await waitFor(() => expect(repository.upsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "Alicia",
      profileDisplayName: "Alicia",
    })));
    expect(useAppStore.getState().profile?.displayName).toBe("Alicia");
    expect(navigation.goBack).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  test("my people separates add paths, active people, and unexpired pending invites", () => {
    const state = remoteState();
    const withPendingInvites: RemoteAppState = {
      ...state,
      connections: [
        ...state.connections,
        {
          connection: {
            ...state.connection!,
            id: secondConnectionId,
            inviteCode: "PENDING1",
            inviteExpiresAt: "2999-05-25T10:00:00.000Z",
          },
          connectedProfile: null,
        },
        {
          connection: {
            ...state.connection!,
            id: expiredConnectionId,
            inviteCode: "EXPIRED1",
            inviteExpiresAt: "2000-05-25T10:00:00.000Z",
          },
          connectedProfile: null,
        },
      ],
    };
    useAppStore.setState(withPendingInvites);
    setAppRepositoryForTesting(fakeRepository(withPendingInvites));
    const navigation = mockNavigation();

    render(<MyPeopleScreen navigation={navigation} route={mockRoute("MyPeople")} />);

    expect(screen.getByText("Add someone")).toBeTruthy();
    expect(screen.getByText("Invite someone")).toBeTruthy();
    expect(screen.getByText("Enter their code")).toBeTruthy();
    expect(screen.getByText("Pending invites")).toBeTruthy();
    expect(screen.getByText("PEND-ING1")).toBeTruthy();
    expect(screen.queryByText("EXPI-RED1")).toBeNull();
    expect(screen.getByText("Existing people")).toBeTruthy();
    expect(screen.getByText("Noah")).toBeTruthy();
    expect(screen.getByText("Save local name")).toBeTruthy();
    expect(screen.getByText("Remove person")).toBeTruthy();

    fireEvent.press(screen.getByText("Invite someone"));
    expect(navigation.navigate).toHaveBeenCalledWith("ConnectionInvite");

    fireEvent.press(screen.getByText("Enter their code"));
    expect(navigation.navigate).toHaveBeenCalledWith("JoinConnection");
  });

  test("my people saves a local name for the selected connection", async () => {
    const repository = fakeRepository(remoteState());
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    setAppRepositoryForTesting(repository);

    render(<MyPeopleScreen navigation={mockNavigation()} route={mockRoute("MyPeople")} />);

    fireEvent.changeText(screen.getByPlaceholderText("Their name"), "Noahby");
    fireEvent.press(screen.getByText("Save local name"));

    await waitFor(() =>
      expect(repository.updateConnectionDisplayName).toHaveBeenCalledWith({
        connectionId,
        targetUserId: noahId,
        displayName: "Noahby",
      }),
    );

    alertSpy.mockRestore();
  });

  test("my people removes a selected connection", async () => {
    const repository = fakeRepository(remoteState());
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    setAppRepositoryForTesting(repository);

    render(<MyPeopleScreen navigation={mockNavigation()} route={mockRoute("MyPeople")} />);

    fireEvent.press(screen.getByText("Remove person"));
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => Promise<void> | void }>;

    await act(async () => {
      await buttons.find((button) => button.text === "Remove")?.onPress?.();
    });

    await waitFor(() => expect(repository.stopConnection).toHaveBeenCalledWith(connectionId));

    alertSpy.mockRestore();
  });

  test("home still shows the creator flow without a connection", () => {
    const noConnection = {
      ...remoteState(),
      connectedProfile: null,
      connection: null,
      connections: [],
      pendingConnectionRequests: [],
      decisions: [],
    };
    useAppStore.setState(noConnection);
    setAppRepositoryForTesting(fakeRepository(noConnection));
    const navigation = mockNavigation();

    render(<HomeScreen navigation={navigation} route={mockRoute("Home")} />);

    expect(screen.getByText("HI LISA")).toBeTruthy();
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
        responderId: noahId,
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
    expect(screen.getByText("Noah chose Blue sofa")).toBeTruthy();
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
        connectionId,
        assignedTo: noahId,
        note: "Need it today",
        options: [
          { label: "A", title: "Black chair", imageUrl: null, imagePath: null },
          { label: "B", title: "White chair", imageUrl: null, imagePath: null },
        ],
      }),
    );
    expect(navigation.replace).toHaveBeenCalledWith("DecisionDetail", { decisionId });
  });

  test("create choice can target a second connection", async () => {
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
    };
    useAppStore.setState(multiConnectionState);
    const repository = fakeRepository(multiConnectionState);
    setAppRepositoryForTesting(repository);

    render(<CreateDecisionScreen navigation={mockNavigation()} route={mockRoute("CreateDecision")} />);

    fireEvent.press(screen.getByText("Charlie"));
    fireEvent.changeText(screen.getByPlaceholderText("Sushi 🍣"), "Black chair");
    fireEvent.changeText(screen.getByPlaceholderText("Thai 🍜"), "White chair");
    fireEvent.press(screen.getByText("JUST CHOOSE"));

    await waitFor(() =>
      expect(repository.createDecisionWithOptions).toHaveBeenCalledWith(expect.objectContaining({
        connectionId: secondConnectionId,
        assignedTo: charlieId,
      })),
    );
  });

  test("create choice asks for a connection only when submitting", async () => {
    const noConnection = {
      ...remoteState(),
      connectedProfile: null,
      connection: null,
      connections: [],
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

    expect(screen.getByText("Waiting for Noah")).toBeTruthy();
    expect(screen.queryByText("Just choose")).toBeNull();
  });

  test("connected profile can answer and result shows the persisted answer", async () => {
    const answered = remoteState({
      status: "answered",
      response: {
        id: "00000000-0000-4000-8000-000000000040",
        decisionId,
        responderId: noahId,
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
      authUserId: noahId,
      profile: { id: noahId, displayName: "Noah", avatarUrl: null },
      connectedProfile: null,
      connection: null,
      connections: [],
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

    await waitFor(() => expect(screen.getByText("Connect with Lisa?")).toBeTruthy());
    expect(repository.acceptConnectionInvite).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByText("Accept connection").at(-1)!);

    await waitFor(() => expect(repository.acceptConnectionInvite).toHaveBeenCalledWith("TESTDUO"));
    expect(navigation.replace).toHaveBeenCalledWith("Home");
  });

  test("invalid invite does not navigate home", async () => {
    useAppStore.setState({
      authUserId: noahId,
      profile: { id: noahId, displayName: "Noah", avatarUrl: null },
      connectedProfile: null,
      connection: null,
      connections: [],
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
        connections: [],
        pendingConnectionRequests: [],
        decisions: [],
      })),
    };
    setAppRepositoryForTesting(repository);
    const navigation = mockNavigation();

    render(<AuthScreen navigation={navigation} route={mockRoute("Auth")} />);

    fireEvent.press(screen.getByText("Use email instead →"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "new@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Minimum 6 characters"), "mielad123");
    fireEvent.press(screen.getByText("Sign up with email"));

    await waitFor(() => expect(repository.signUpWithEmail).toHaveBeenCalledWith("new@example.com", "mielad123"));
    expect(navigation.navigate).toHaveBeenCalledWith("CreateProfile");
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
      inviteExpiresAt: "2999-05-25T10:00:00.000Z",
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
          inviteExpiresAt: "2999-05-25T10:00:00.000Z",
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
    responderId: noahId,
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
    createDecisionWithOptions: jest.fn(async () => decision),
    answerDecision: jest.fn(async () => response),
    savePushToken: jest.fn(async () => undefined),
    updateConnectionDisplayName: jest.fn(async () => state),
    stopConnection: jest.fn(async () => ({ ...state, connections: [], connection: null, connectedProfile: null, decisions: [] })),
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
