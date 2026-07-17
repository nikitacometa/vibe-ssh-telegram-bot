import { beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../src/session-manager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('reuses sessions by user and initializes fresh defaults', () => {
    const first = manager.getOrCreateSession(1);
    const sameUser = manager.getOrCreateSession(1);
    const otherUser = manager.getOrCreateSession(2);

    expect(sameUser).toBe(first);
    expect(otherUser).not.toBe(first);
    expect(first.commandHistory).toEqual([]);
    expect(first.preferences.quickCommands).toBe(true);
    expect(first.preferences.aiSuggestions).toBe(true);
  });

  it('registers an action and enforces ownership on lookup', () => {
    const id = manager.registerAction(10, 'docker ps', 'server-a');

    expect(id).toBe('1');
    expect(manager.getAction(id, 10)).toEqual({
      userId: 10,
      command: 'docker ps',
      serverId: 'server-a',
      createdAt: expect.any(Number)
    });
    expect(manager.getAction(id, 11)).toBeUndefined();
  });

  it('allows an action to be taken only once', () => {
    const id = manager.registerAction(10, 'uptime', 'server-a');

    expect(manager.takeAction(id, 10)).toEqual({
      userId: 10,
      command: 'uptime',
      serverId: 'server-a',
      createdAt: expect.any(Number)
    });
    expect(manager.takeAction(id, 10)).toBeUndefined();
  });

  it('keeps the newest action after exceeding the 200-action cap', () => {
    let newestId = '';
    for (let index = 0; index < 250; index += 1) {
      newestId = manager.registerAction(10, `command-${index}`, 'server-a');
    }

    expect(newestId).toBe('250');
    expect(manager.getAction(newestId, 10)?.command).toBe('command-249');
  });

  it('yields every created session', () => {
    const first = manager.getOrCreateSession(10);
    const second = manager.getOrCreateSession(20);

    expect([...manager.allSessions()]).toEqual([first, second]);
  });
});
