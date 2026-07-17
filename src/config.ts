import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ServerConfig, SSHConfig } from './types';
import { logger } from './logger';

dotenv.config();

function parseAllowedUserIds(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(part => Number(part.trim()))
    .filter(id => Number.isInteger(id) && id > 0);
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  allowedUserIds: parseAllowedUserIds(process.env.ALLOWED_TELEGRAM_USER_IDS),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  whisperLanguage: process.env.WHISPER_LANGUAGE || '',
  serversConfigPath: path.join(__dirname, '../config/servers.json'),
  defaultSSHConfig: {
    host: process.env.SSH_HOST || '',
    username: process.env.SSH_USERNAME || '',
    password: process.env.SSH_PASSWORD,
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH,
    port: parseInt(process.env.SSH_PORT || '22', 10),
    // Persistent host-key pin for the default server. Without it the pin is
    // trust-on-first-use and re-learned on each restart.
    hostKeyFingerprint: process.env.SSH_HOST_KEY_FINGERPRINT || undefined
  } as SSHConfig
};

export function loadServers(): ServerConfig[] {
  // Legacy path kept as a fallback for installs created before the rename
  const legacyPath = path.join(path.dirname(config.serversConfigPath), 'mcp-servers.json');

  let savedServers: ServerConfig[] = [];
  try {
    const configPath = fs.existsSync(config.serversConfigPath)
      ? config.serversConfigPath
      : fs.existsSync(legacyPath)
        ? legacyPath
        : undefined;

    if (configPath) {
      const data = fs.readFileSync(configPath, 'utf-8');
      savedServers = JSON.parse(data);
    }
  } catch (error) {
    logger.error('Error loading server config:', error);
  }

  // The default server is always derived from env, never from the saved file
  const userServers = savedServers.filter(s => s.id !== 'default-ssh');

  if (!config.defaultSSHConfig.host) {
    return userServers;
  }

  return [
    {
      id: 'default-ssh',
      name: 'Default SSH Server',
      type: 'ssh',
      config: config.defaultSSHConfig,
      enabled: true
    },
    ...userServers
  ];
}

export function saveServers(servers: ServerConfig[]): void {
  const dir = path.dirname(config.serversConfigPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  // The file holds SSH credentials: keep it owner-only, and never persist
  // the env-derived default server (its secrets already live in .env)
  const persistable = servers.filter(s => s.id !== 'default-ssh');

  fs.writeFileSync(config.serversConfigPath, JSON.stringify(persistable, null, 2), { mode: 0o600 });
  fs.chmodSync(config.serversConfigPath, 0o600);
}
