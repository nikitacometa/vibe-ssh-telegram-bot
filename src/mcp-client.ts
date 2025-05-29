import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServerConfig } from './types';

export class MCPClient {
  private clients: Map<string, Client> = new Map();

  async connectToServer(serverConfig: MCPServerConfig): Promise<void> {
    if (!serverConfig.enabled) {
      throw new Error(`Server ${serverConfig.name} is disabled`);
    }

    if (this.clients.has(serverConfig.id)) {
      await this.disconnectFromServer(serverConfig.id);
    }

    try {
      const client = new Client({
        name: `telegram-bot-client-${serverConfig.id}`,
        version: '1.0.0'
      });

      let transport: StdioClientTransport;

      if (serverConfig.type === 'ssh') {
        // For SSH server, we'll use the mcp-server-ssh
        transport = new StdioClientTransport({
          command: 'npx',
          args: ['-y', '@shaike/mcp-ssh'],
          env: {
            ...process.env,
            SSH_HOST: serverConfig.config.host,
            SSH_USERNAME: serverConfig.config.username,
            SSH_PASSWORD: serverConfig.config.password,
            SSH_PRIVATE_KEY_PATH: serverConfig.config.privateKeyPath,
            SSH_PORT: serverConfig.config.port?.toString() || '22'
          }
        });
      } else {
        throw new Error(`Unsupported server type: ${serverConfig.type}`);
      }

      await client.connect(transport);
      this.clients.set(serverConfig.id, client);
      
      console.log(`Connected to MCP server: ${serverConfig.name}`);
    } catch (error) {
      console.error(`Failed to connect to server ${serverConfig.name}:`, error);
      throw error;
    }
  }

  async disconnectFromServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
      this.clients.delete(serverId);
    }
  }

  async executeCommand(serverId: string, command: string): Promise<string> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    try {
      // Call the SSH execute tool
      const result = await client.callTool({
        name: 'ssh_command',
        arguments: {
          command: command
        }
      });

      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const content = result.content[0];
        if (typeof content === 'object' && content !== null && 'type' in content && content.type === 'text' && 'text' in content) {
          return content.text as string;
        }
      }
      
      return 'Command executed successfully (no output)';
    } catch (error) {
      console.error('Error executing command:', error);
      throw error;
    }
  }

  async listAvailableTools(serverId: string): Promise<any[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Not connected to server: ${serverId}`);
    }

    const tools = await client.listTools();
    return tools.tools || [];
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }
}