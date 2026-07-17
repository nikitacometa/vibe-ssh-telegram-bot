export interface ServerConfig {
  id: string;
  name: string;
  type: 'ssh';
  config: SSHConfig;
  enabled: boolean;
}

export interface SSHConfig {
  host: string;
  username: string;
  password?: string;
  privateKeyPath?: string;
  privateKey?: string;
  port?: number;
  /** Pinned SHA-256 host key fingerprint, recorded on first successful connect. */
  hostKeyFingerprint?: string;
}

export interface CommandConfirmation {
  userId: number;
  command: string;
  serverId: string;
  timestamp: number;
  confirmed: boolean;
  /** Id of the button action this confirmation belongs to. */
  actionId?: string;
}

/**
 * A command referenced from an inline button. Buttons carry only a short
 * action id (Telegram limits callback_data to 64 bytes), the command itself
 * lives here.
 */
export interface PendingAction {
  userId: number;
  command: string;
  serverId: string;
  createdAt: number;
}

export interface UserSession {
  userId: number;
  activeServer?: string;
  pendingConfirmation?: CommandConfirmation;
  commandHistory: string[];
  lastCommandOutput?: string;
  lastActivity: number;
  preferences: {
    quickCommands: boolean;
    verboseOutput: boolean;
    aiSuggestions: boolean;
  };
  serverSetup?: ServerSetupState;
  activeCommands: Map<string, ActiveCommand>;
}

export interface ServerSetupState {
  step: 'hostname' | 'name' | 'port' | 'username' | 'auth_method' | 'password' | 'private_key' | 'confirm';
  serverData: Partial<SSHConfig & { name: string; privateKey?: string }>;
}

import type { ClientChannel } from 'ssh2';

export interface ActiveCommand {
  messageId: number;
  stream?: ClientChannel;
  startTime: number;
  command: string;
  serverId: string;
}