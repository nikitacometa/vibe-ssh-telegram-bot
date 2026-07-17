export interface ServerConfig {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
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
  activeCommands?: Map<string, ActiveCommand>;
}

export interface ServerSetupState {
  step: 'hostname' | 'name' | 'port' | 'username' | 'auth_method' | 'password' | 'private_key' | 'confirm';
  serverData: Partial<SSHConfig & { name: string; privateKey?: string }>;
}

export interface ActiveCommand {
  messageId: number;
  process?: any;
  startTime: number;
  command: string;
  serverId: string;
}