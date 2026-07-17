import { UserSession, PendingAction } from './types';

/** Maximum number of button actions kept in memory before the oldest is evicted. */
const MAX_PENDING_ACTIONS = 200;

/**
 * Owns per-user session state and the registry of pending button actions.
 *
 * Telegram limits inline-button callback_data to 64 bytes, so buttons carry
 * only a short action id; the command they refer to lives in the registry.
 * Keeping this state here (rather than in the bot god-class) makes the
 * confirmation/cancel flow independently testable.
 */
export class SessionManager {
  private readonly sessions: Map<number, UserSession> = new Map();
  private readonly pendingActions: Map<string, PendingAction> = new Map();
  private nextActionId = 1;

  /** Returns the user's session, creating a fresh one on first contact. */
  getOrCreateSession(userId: number): UserSession {
    let session = this.sessions.get(userId);
    if (!session) {
      session = {
        userId,
        activeServer: undefined,
        pendingConfirmation: undefined,
        commandHistory: [],
        lastActivity: Date.now(),
        preferences: {
          quickCommands: true,
          verboseOutput: false,
          aiSuggestions: true
        },
        serverSetup: undefined,
        activeCommands: new Map()
      };
      this.sessions.set(userId, session);
    }
    return session;
  }

  /** All known sessions, for broadcast-style operations (e.g. server removal). */
  allSessions(): IterableIterator<UserSession> {
    return this.sessions.values();
  }

  /**
   * Registers a command behind a short action id used as button callback_data.
   * Evicts the oldest entry once the registry is full so it cannot grow without
   * bound.
   */
  registerAction(userId: number, command: string, serverId: string): string {
    const id = String(this.nextActionId++);
    this.pendingActions.set(id, { userId, command, serverId, createdAt: Date.now() });

    if (this.pendingActions.size > MAX_PENDING_ACTIONS) {
      const oldest = this.pendingActions.keys().next().value;
      if (oldest !== undefined) this.pendingActions.delete(oldest);
    }
    return id;
  }

  /** Looks up an action, enforcing that only its owner can use the button. */
  getAction(id: string, userId: number): PendingAction | undefined {
    const action = this.pendingActions.get(id);
    return action && action.userId === userId ? action : undefined;
  }

  /**
   * Atomically consumes an action: the entry is removed before the caller does
   * any async work, so a double-click or a stale button can never execute the
   * same command twice or run a command other than the one shown.
   */
  takeAction(id: string, userId: number): PendingAction | undefined {
    const action = this.getAction(id, userId);
    if (action) this.pendingActions.delete(id);
    return action;
  }
}
