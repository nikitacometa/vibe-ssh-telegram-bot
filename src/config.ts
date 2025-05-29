import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { MCPServerConfig, SSHConfig } from './types';

dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  mcpServersConfigPath: path.join(__dirname, '../config/mcp-servers.json'),
  defaultSSHConfig: {
    host: process.env.SSH_HOST || '',
    username: process.env.SSH_USERNAME || '',
    password: process.env.SSH_PASSWORD,
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH,
    port: parseInt(process.env.SSH_PORT || '22', 10)
  } as SSHConfig
};

export function loadMCPServers(): MCPServerConfig[] {
  try {
    if (fs.existsSync(config.mcpServersConfigPath)) {
      const data = fs.readFileSync(config.mcpServersConfigPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading MCP servers:', error);
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

export function saveMCPServers(servers: MCPServerConfig[]): void {
  const dir = path.dirname(config.mcpServersConfigPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(
    config.mcpServersConfigPath,
    JSON.stringify(servers, null, 2)
  );
}