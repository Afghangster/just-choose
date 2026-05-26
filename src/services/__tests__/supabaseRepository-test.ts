import { createSupabaseRepository } from "../supabaseRepository";

const aliceId = "00000000-0000-4000-8000-000000000001";
const bobId = "00000000-0000-4000-8000-000000000002";
const charlieId = "00000000-0000-4000-8000-000000000003";
const connectionId = "00000000-0000-4000-8000-000000000010";
const charlieConnectionId = "00000000-0000-4000-8000-000000000020";
const decisionId = "00000000-0000-4000-8000-000000000030";
const optionAId = "00000000-0000-4000-8000-000000000031";
const optionBId = "00000000-0000-4000-8000-000000000032";
const futureDate = "2999-05-25T10:00:00.000Z";
const pastDate = "2000-05-25T10:00:00.000Z";

describe("createSupabaseRepository simplified model", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(async () => ({ ok: true })) as jest.Mock;
  });

  test("hydrates a two-person connection into app domain models", async () => {
    const client = createFakeSupabaseClient(aliceId, seededTables());
    const repository = createSupabaseRepository(client);

    const state = await repository.loadCurrentUserAppState();

    expect(state.profile?.displayName).toBe("Alice");
    expect(state.connectedProfile?.displayName).toBe("Bob");
    expect(state.connection?.inviteCode).toBe("");
    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0].title).toBe("Green sofa or Blue sofa?");
    expect(state.decisions[0].options.map((option) => option.title)).toEqual([
      "Green sofa",
      "Blue sofa",
    ]);
    expect(state.decisions[0].response?.responseType).toBe("selected_option");
  });

  test("previews then accepts an invite before creating a decision", async () => {
    const tables = seededTables({ includeBobMembership: false, includeDecision: false });
    const client = createFakeSupabaseClient(bobId, tables);
    const repository = createSupabaseRepository(client);

    const preview = await repository.previewConnectionInvite("testduo");
    expect(preview).toMatchObject({
      code: "TESTDUO",
      inviterDisplayName: "Alice",
      expiresAt: futureDate,
    });
    expect(tables.connection_members.some((row) => row.user_id === bobId)).toBe(false);

    const requested = await repository.acceptConnectionInvite("testduo");
    expect(requested.connection).toBeNull();
    expect(tables.connection_members.find((row) => row.user_id === bobId)?.status).toBe("invited");

    const aliceRepository = createSupabaseRepository(createFakeSupabaseClient(aliceId, tables));
    const aliceState = await aliceRepository.loadCurrentUserAppState();
    expect(aliceState.pendingConnectionRequests[0]).toMatchObject({
      requesterId: bobId,
      requesterDisplayName: "Bob",
    });

    await aliceRepository.approveConnectionRequest(bobId);
    const joined = await repository.loadCurrentUserAppState();
    expect(joined.connection?.id).toBe(connectionId);
    expect(joined.connectedProfile?.id).toBe(aliceId);

    const decision = await repository.createDecisionWithOptions({
      note: "Need it today",
      options: [
        { label: "A", title: "Tall lamp" },
        { label: "B", title: "Small lamp" },
      ],
    });

    expect(decision.id).toMatch(UUIDish);
    expect(decision.title).toBe("Tall lamp or Small lamp?");
    expect(tables.decisions[0]).toMatchObject({
      connection_id: connectionId,
      note: "Need it today",
      status: "pending",
    });
    expect(tables.decisions[0]).not.toHaveProperty("category");
    expect(tables.decision_options).toHaveLength(2);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("ExponentPushToken[alice]"),
      }),
    );
  });

  test("creates a server-side one-hour invite and revokes older pending invites", async () => {
    const tables = seededTables({ includeBobMembership: false, includeDecision: false });
    const client = createFakeSupabaseClient(aliceId, tables);
    const repository = createSupabaseRepository(client);

    const state = await repository.createConnectionInvite();

    expect(state.connection?.inviteCode).toMatch(/^[A-Z0-9]{12}$/);
    expect(state.connection?.inviteCode).not.toBe("TESTDUO");
    expect(tables.connection_invites.find((row) => row.code === "TESTDUO")?.status).toBe("revoked");
    const activeInvites = tables.connection_invites.filter((row) => row.status === "pending");
    expect(activeInvites).toHaveLength(1);
    const activeInvite = activeInvites[0];
    expect(activeInvite?.code).toBe(state.connection?.inviteCode);
    expect(Date.parse(activeInvite!.expires_at) - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  test("new invite codes are rate-limited to one per minute", async () => {
    const tables = seededTables({ includeBobMembership: false, includeDecision: false });
    const client = createFakeSupabaseClient(aliceId, tables);
    const repository = createSupabaseRepository(client);

    await repository.createConnectionInvite();

    await expect(repository.createConnectionInvite()).rejects.toThrow(
      "Please wait one minute before creating a new invite code.",
    );
    expect(tables.connection_invites.filter((row) => row.status === "pending")).toHaveLength(1);
  });

  test("expired, accepted, self-created, and already-connected invites cannot be used", async () => {
    await expect(
      createSupabaseRepository(createFakeSupabaseClient(bobId, seededTables({
        includeBobMembership: false,
        includeDecision: false,
        inviteExpiresAt: pastDate,
      }))).previewConnectionInvite("TESTDUO"),
    ).rejects.toThrow("Invite code not found or expired.");

    await expect(
      createSupabaseRepository(createFakeSupabaseClient(charlieId, seededTables())).acceptConnectionInvite("TESTDUO"),
    ).rejects.toThrow("Invite code not found or expired.");

    const revokedTables = seededTables({ includeBobMembership: false, includeDecision: false });
    revokedTables.connection_invites[0].status = "revoked";
    await expect(
      createSupabaseRepository(createFakeSupabaseClient(bobId, revokedTables)).acceptConnectionInvite("TESTDUO"),
    ).rejects.toThrow("Invite code not found or expired.");

    await expect(
      createSupabaseRepository(createFakeSupabaseClient(aliceId, seededTables({
        includeBobMembership: false,
        includeDecision: false,
      }))).previewConnectionInvite("TESTDUO"),
    ).rejects.toThrow("You cannot accept your own invite.");

    await expect(
      createSupabaseRepository(createFakeSupabaseClient(charlieId, seededTables({
        includeBobMembership: false,
        includeDecision: false,
        includeCharlieMembership: true,
      }))).acceptConnectionInvite("TESTDUO"),
    ).rejects.toThrow("You already have an accepted connection.");
  });

  test("a third user cannot reuse an invite after it is accepted once", async () => {
    const tables = seededTables({ includeBobMembership: false, includeDecision: false });
    await createSupabaseRepository(createFakeSupabaseClient(bobId, tables)).acceptConnectionInvite("TESTDUO");

    await expect(
      createSupabaseRepository(createFakeSupabaseClient(charlieId, tables)).acceptConnectionInvite("TESTDUO"),
    ).rejects.toThrow("Invite code not found or expired.");
  });

  test("answers a pending decision and trigger marks it answered remotely", async () => {
    const tables = seededTables({ includeResponse: false });
    const client = createFakeSupabaseClient(bobId, tables);
    const repository = createSupabaseRepository(client);

    const response = await repository.answerDecision(decisionId, {
      responseType: "selected_option",
      selectedOptionId: optionBId,
      comment: "This one",
    });

    expect(response.id).toMatch(UUIDish);
    expect(response.selectedOptionId).toBe(optionBId);
    expect(response.comment).toBe("This one");
    expect(tables.decision_responses).toHaveLength(1);
    expect(tables.decisions[0].status).toBe("answered");
  });

  test("connection display names are private labels for the current user", async () => {
    const tables = seededTables();
    const repository = createSupabaseRepository(createFakeSupabaseClient(aliceId, tables));

    const renamed = await repository.updateConnectionDisplayName({
      connectionId,
      targetUserId: bobId,
      displayName: "Bobby Tables",
    });

    expect(renamed.connectedProfile?.displayName).toBe("Bobby Tables");
    expect(renamed.connectedProfile?.profileDisplayName).toBe("Bob");
    expect(tables.connection_aliases[0]).toMatchObject({
      connection_id: connectionId,
      owner_user_id: aliceId,
      target_user_id: bobId,
      display_name: "Bobby Tables",
    });
  });

  test("stopping a connection removes active memberships and clears state", async () => {
    const tables = seededTables();
    const repository = createSupabaseRepository(createFakeSupabaseClient(aliceId, tables));

    const stopped = await repository.stopConnection(connectionId);

    expect(stopped.connection).toBeNull();
    expect(stopped.connectedProfile).toBeNull();
    expect(tables.connection_members.every((row) => row.status === "removed")).toBe(true);
  });
});

const UUIDish = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

function seededTables({
  includeBobMembership = true,
  includeDecision = true,
  includeResponse = true,
  includeCharlieMembership = false,
  inviteExpiresAt = futureDate,
} = {}) {
  return {
    profiles: [
      { id: aliceId, display_name: "Alice", age: 31, gender: "woman", avatar_url: null },
      { id: bobId, display_name: "Bob", age: 32, gender: "man", avatar_url: null },
      { id: charlieId, display_name: "Charlie", age: 29, gender: "prefer_not_to_say", avatar_url: null },
    ],
    connection_aliases: [],
    connections: [
      {
        id: connectionId,
        invite_code: "TESTDUO",
        created_by: aliceId,
        billing_owner_user_id: aliceId,
        subscription_status: "active",
        plan: "connection",
        subscription_current_period_end: null,
        created_at: "2026-05-25T09:00:00.000Z",
      },
      ...(includeCharlieMembership
        ? [
            {
              id: charlieConnectionId,
              invite_code: "CHARLIEONE",
              created_by: charlieId,
              billing_owner_user_id: charlieId,
              subscription_status: "inactive",
              plan: "free",
              subscription_current_period_end: null,
              created_at: "2026-05-25T09:00:00.000Z",
            },
          ]
        : []),
    ],
    connection_members: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        connection_id: connectionId,
        user_id: aliceId,
        role: "owner",
        status: "accepted",
        invited_by: aliceId,
        accepted_at: "2026-05-25T09:00:00.000Z",
        joined_at: "2026-05-25T09:00:00.000Z",
      },
      ...(includeBobMembership
        ? [
            {
              id: "00000000-0000-4000-8000-000000000012",
              connection_id: connectionId,
              user_id: bobId,
              role: "member",
              status: "accepted",
              invited_by: aliceId,
              accepted_at: "2026-05-25T09:00:00.000Z",
              joined_at: "2026-05-25T09:00:00.000Z",
            },
          ]
        : []),
      ...(includeCharlieMembership
        ? [
            {
              id: "00000000-0000-4000-8000-000000000014",
              connection_id: charlieConnectionId,
              user_id: charlieId,
              role: "owner",
              status: "accepted",
              invited_by: charlieId,
              accepted_at: "2026-05-25T09:00:00.000Z",
              joined_at: "2026-05-25T09:00:00.000Z",
            },
          ]
        : []),
    ],
    connection_invites: [
      {
        id: "00000000-0000-4000-8000-000000000013",
        connection_id: connectionId,
        code: "TESTDUO",
        created_by: aliceId,
        accepted_by: includeBobMembership ? bobId : null,
        status: includeBobMembership ? "accepted" : "pending",
        max_uses: 1,
        use_count: includeBobMembership ? 1 : 0,
        expires_at: inviteExpiresAt,
        accepted_at: includeBobMembership ? "2026-05-25T09:00:00.000Z" : null,
        revoked_at: null,
        created_at: "2026-05-25T09:00:00.000Z",
        updated_at: "2026-05-25T09:00:00.000Z",
      },
    ],
    decisions: includeDecision
      ? [
          {
            id: decisionId,
            connection_id: connectionId,
            created_by: aliceId,
            assigned_to: bobId,
            note: null,
            status: includeResponse ? "answered" : "pending",
            created_at: "2026-05-25T09:00:00.000Z",
            updated_at: "2026-05-25T09:00:00.000Z",
            answered_at: includeResponse ? "2026-05-25T09:01:00.000Z" : null,
          },
        ]
      : [],
    decision_options: includeDecision
      ? [
          {
            id: optionAId,
            decision_id: decisionId,
            label: "A",
            title: "Green sofa",
            image_url: null,
            sort_order: 0,
          },
          {
            id: optionBId,
            decision_id: decisionId,
            label: "B",
            title: "Blue sofa",
            image_url: null,
            sort_order: 1,
          },
        ]
      : [],
    decision_responses: includeResponse
      ? [
          {
            id: "00000000-0000-4000-8000-000000000033",
            decision_id: decisionId,
            responder_id: bobId,
            selected_option_id: optionAId,
            response_type: "selected_option",
            comment: "Looks better",
            created_at: "2026-05-25T09:01:00.000Z",
          },
        ]
      : [],
    push_tokens: [
      {
        id: "00000000-0000-4000-8000-000000000050",
        user_id: aliceId,
        token: "ExponentPushToken[alice]",
        platform: "ios",
      },
    ],
  } as Record<string, any[]>;
}

function createFakeSupabaseClient(userId: string, tables: Record<string, any[]>) {
  let nextId = 100;
  const uuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

  return {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: userId } }, error: null })),
      signInWithPassword: jest.fn(async () => ({ data: { user: { id: userId } }, error: null })),
      signInWithOAuth: jest.fn(async () => ({ data: { url: "https://example.com/auth" }, error: null })),
      exchangeCodeForSession: jest.fn(async () => ({ data: { user: { id: userId } }, error: null })),
      signInWithIdToken: jest.fn(async () => ({ data: { user: { id: userId } }, error: null })),
      signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
      verifyOtp: jest.fn(async () => ({ data: { user: { id: userId }, session: {} }, error: null })),
      signUp: jest.fn(async () => ({ data: { user: { id: userId }, session: {} }, error: null })),
      resend: jest.fn(async () => ({ data: {}, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
    },
    from(table: string) {
      return new FakeQuery(table, tables, uuid);
    },
    rpc: jest.fn(async (fn: string, args: Record<string, string>) => {
      if (fn === "create_connection_invite") {
        const membership = tables.connection_members.find((row) => row.user_id === userId && row.status === "accepted");
        let targetConnectionId = membership?.connection_id;
        let code = `PAIR${String(nextId++).padStart(8, "0")}`;
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000 - 1000).toISOString();
        const latestPendingInvite = tables.connection_invites
          .filter((row) => row.created_by === userId && row.status === "pending" && Date.parse(row.expires_at) > Date.now())
          .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];

        if (
          targetConnectionId &&
          tables.connection_members.some((row) => row.connection_id === targetConnectionId && row.user_id !== userId && row.status === "accepted")
        ) {
          return { data: null, error: new Error("You already have an accepted connection.") };
        }

        if (latestPendingInvite && Date.parse(latestPendingInvite.created_at) > Date.now() - 60 * 1000) {
          return { data: null, error: new Error("Please wait one minute before creating a new invite code.") };
        }

        while (tables.connection_invites.some((row) => row.code === code) || tables.connections.some((row) => row.invite_code === code)) {
          code = `PAIR${String(nextId++).padStart(8, "0")}`;
        }

        if (!targetConnectionId) {
          targetConnectionId = uuid();
          tables.connections.push({
            id: targetConnectionId,
            invite_code: code,
            created_by: userId,
            billing_owner_user_id: null,
            subscription_status: "inactive",
            plan: "free",
            subscription_current_period_end: null,
            created_at: new Date().toISOString(),
          });
          tables.connection_members.push({
            id: uuid(),
            connection_id: targetConnectionId,
            user_id: userId,
            role: "owner",
            status: "accepted",
            invited_by: userId,
            accepted_at: new Date().toISOString(),
            joined_at: new Date().toISOString(),
          });
        } else {
          tables.connection_invites
            .filter((row) => row.connection_id === targetConnectionId && row.created_by === userId && row.status === "pending")
            .forEach((row) => {
              row.status = "revoked";
              row.revoked_at = new Date().toISOString();
            });
          const connection = tables.connections.find((row) => row.id === targetConnectionId);
          if (connection) {
            connection.invite_code = code;
          }
        }

        const invite = {
          id: uuid(),
          connection_id: targetConnectionId,
          code,
          created_by: userId,
          accepted_by: null,
          status: "pending",
          max_uses: 1,
          use_count: 0,
          expires_at: expiresAt,
          accepted_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        tables.connection_invites.push(invite);
        return { data: [invite], error: null };
      }

      if (fn === "preview_connection_invite") {
        const invite = findUsableInvite(tables, args.invite_code_input);
        if (!invite) {
          return { data: null, error: new Error("Invite code not found or expired.") };
        }
        const validationError = validateInviteForUser(tables, invite, userId);
        if (validationError) {
          return { data: null, error: validationError };
        }
        const inviter = tables.profiles.find((row) => row.id === invite.created_by);
        return {
          data: [
            {
              code: invite.code,
              inviter_display_name: inviter?.display_name ?? "Someone",
              expires_at: invite.expires_at,
            },
          ],
          error: null,
        };
      }

      if (fn === "stop_connection") {
        const membership = tables.connection_members.find(
          (row) => row.connection_id === args.target_connection_id && row.user_id === userId && row.status === "accepted",
        );
        if (!membership) {
          return { data: null, error: new Error("Connection not found.") };
        }
        tables.connection_members
          .filter((row) => row.connection_id === args.target_connection_id && row.status === "accepted")
          .forEach((row) => {
            row.status = "removed";
          });
        tables.connection_invites
          .filter((row) => row.connection_id === args.target_connection_id && row.status === "pending")
          .forEach((row) => {
            row.status = "revoked";
          });
        return { data: null, error: null };
      }

      if (fn === "pending_connection_requests") {
        const ownerMemberships = tables.connection_members.filter((row) => row.user_id === userId && row.status === "accepted");
        return {
          data: ownerMemberships.flatMap((owner) =>
            tables.connection_members
              .filter((row) => row.connection_id === owner.connection_id && row.status === "invited" && row.user_id !== userId)
              .map((row) => {
                const profile = tables.profiles.find((profileRow) => profileRow.id === row.user_id);
                return {
                  connection_id: row.connection_id,
                  requester_id: row.user_id,
                  requester_display_name: profile?.display_name ?? "Someone",
                  requested_at: row.joined_at,
                };
              }),
          ),
          error: null,
        };
      }

      if (fn === "approve_connection_request") {
        const request = tables.connection_members.find((row) => row.user_id === args.requester_user_id && row.status === "invited");
        if (!request) {
          return { data: null, error: new Error("Connection request not found.") };
        }
        request.status = "accepted";
        request.accepted_at = new Date().toISOString();
        return { data: request.connection_id, error: null };
      }

      if (fn === "reject_connection_request") {
        const request = tables.connection_members.find((row) => row.user_id === args.requester_user_id && row.status === "invited");
        if (!request) {
          return { data: null, error: new Error("Connection request not found.") };
        }
        request.status = "declined";
        return { data: request.connection_id, error: null };
      }

      if (fn !== "accept_connection_invite" && fn !== "join_connection_by_invite") {
        return { data: null, error: new Error(`Unsupported RPC ${fn}`) };
      }
      const invite = findUsableInvite(tables, args.invite_code_input);
      if (!invite) {
        return { data: null, error: new Error("Invite code not found or expired.") };
      }
      const validationError = validateInviteForUser(tables, invite, userId);
      if (validationError) {
        return { data: null, error: validationError };
      }
      if (!tables.connection_members.some((row) => row.connection_id === invite.connection_id && row.user_id === userId)) {
        tables.connection_members.push({
          id: uuid(),
          connection_id: invite.connection_id,
          user_id: userId,
          role: "member",
          status: "invited",
          invited_by: invite.created_by,
          accepted_at: null,
          joined_at: new Date().toISOString(),
        });
      }
      invite.status = "accepted";
      invite.accepted_by = userId;
      invite.accepted_at = new Date().toISOString();
      invite.use_count = 1;
      return { data: invite.connection_id, error: null };
    }),
  };
}

function findUsableInvite(tables: Record<string, any[]>, inviteCode: string) {
  const normalizedCode = inviteCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  tables.connection_invites
    .filter((row) => row.code === normalizedCode && row.status === "pending" && Date.parse(row.expires_at) <= Date.now())
    .forEach((row) => {
      row.status = "expired";
    });
  return tables.connection_invites.find(
    (row) =>
      row.code === normalizedCode &&
      row.status === "pending" &&
      row.use_count < row.max_uses &&
      Date.parse(row.expires_at) > Date.now(),
  );
}

function validateInviteForUser(tables: Record<string, any[]>, invite: any, userId: string) {
  if (invite.created_by === userId) {
    return new Error("You cannot accept your own invite.");
  }
  const existingMembership = tables.connection_members.find((row) => row.user_id === userId && row.status === "accepted");
  if (existingMembership && existingMembership.connection_id !== invite.connection_id) {
    return new Error("You already have an accepted connection.");
  }
  return null;
}

class FakeQuery {
  private filters: Array<(row: any) => boolean> = [];
  private limitCount: number | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private mutation: { type: "insert" | "update"; rows?: any[]; patch?: any } | null = null;
  private wantsSingle = false;
  private wantsMaybeSingle = false;

  constructor(
    private table: string,
    private tables: Record<string, any[]>,
    private uuid: () => string,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push((row) => String(row[column]) > String(value));
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.orderBy = { column, ascending: options.ascending };
    return this;
  }

  insert(rows: any | any[]) {
    this.mutation = { type: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  update(patch: any) {
    this.mutation = { type: "update", patch };
    return this;
  }

  upsert(rows: any | any[]) {
    this.mutation = { type: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this.execute();
  }

  then(resolve: (value: any) => void, reject: (reason?: any) => void) {
    return this.execute().then(resolve, reject);
  }

  private async execute() {
    const tableRows = this.tables[this.table] ?? [];
    let resultRows: any[];

    if (this.mutation?.type === "insert") {
      resultRows = this.mutation.rows!.map((row) => {
        const inserted = { id: row.id ?? this.uuid(), ...row };
        tableRows.push(inserted);
        if (this.table === "decision_responses") {
          const decision = this.tables.decisions.find((item) => item.id === inserted.decision_id);
          if (decision) {
            decision.status = "answered";
            decision.answered_at = inserted.created_at;
            decision.updated_at = inserted.created_at;
          }
        }
        return inserted;
      });
    } else if (this.mutation?.type === "update") {
      resultRows = tableRows.filter((row) => this.filters.every((filter) => filter(row)));
      resultRows.forEach((row) => Object.assign(row, this.mutation!.patch));
    } else {
      resultRows = tableRows.filter((row) => this.filters.every((filter) => filter(row)));
    }

    if (this.orderBy) {
      resultRows = [...resultRows].sort((a, b) => {
        const result = String(a[this.orderBy!.column]).localeCompare(String(b[this.orderBy!.column]));
        return this.orderBy!.ascending ? result : -result;
      });
    }
    if (this.limitCount !== null) {
      resultRows = resultRows.slice(0, this.limitCount);
    }
    if (this.wantsSingle) {
      return { data: resultRows[0], error: resultRows[0] ? null : new Error("No rows") };
    }
    if (this.wantsMaybeSingle) {
      return { data: resultRows[0] ?? null, error: null };
    }
    return { data: resultRows, error: null };
  }
}
