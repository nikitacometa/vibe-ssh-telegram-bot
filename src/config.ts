import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ServerConfig, SSHConfig } from './types';

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
  openaiModelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  serversConfigPath: path.join(__dirname, '../config/servers.json'),
  defaultSSHConfig: {
    host: process.env.SSH_HOST || '',
    username: process.env.SSH_USERNAME || '',
    password: process.env.SSH_PASSWORD,
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH,
    port: parseInt(process.env.SSH_PORT || '22', 10)
  } as SSHConfig
};

export function loadServers(): ServerConfig[] {
  // Legacy path kept as a fallback for installs created before the rename
  const legacyPath = path.join(path.dirname(config.serversConfigPath), 'mcp-servers.json');

  try {
    const configPath = fs.existsSync(config.serversConfigPath)
      ? config.serversConfigPath
      : fs.existsSync(legacyPath) ? legacyPath : undefined;

    if (configPath) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading server config:', error);
  }

  // Return default SSH server if no config exists
  return [{
    id: 'default-ssh',
    name: 'Default SSH Server',
    type: 'ssh',
    config: config.defaultSSHConfig,
    enabled: true
  }];
}

export function saveServers(servers: ServerConfig[]): void {
  const dir = path.dirname(config.serversConfigPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    config.serversConfigPath,
    JSON.stringify(servers, null, 2)
  );
}