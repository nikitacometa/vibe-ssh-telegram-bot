import { Client as SSHClient } from 'ssh2';
import { SSHConfig } from './types';

export class SimpleSSHClient {
  private connections: Map<string, SSHClient> = new Map();

  async connect(serverId: string, config: SSHConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new SSHClient();
      
      conn.on('ready', () => {
        console.log(`SSH connection established to ${config.host}`);
        this.connections.set(serverId, conn);
        resolve();
      });

      conn.on('error', (err) => {
        console.error(`SSH connection error: ${err.message}`);
        reject(err);
      });

      const connectionConfig: any = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
      };

      if (config.password) {
        connectionConfig.password = config.password;
      } else if (config.privateKey) {
        // Use the private key content directly
        connectionConfig.privateKey = config.privateKey;
      } else if (config.privateKeyPath) {
        const fs = require('fs');
        connectionConfig.privateKey = fs.readFileSync(config.privateKeyPath);
      }

      conn.connect(connectionConfig);
    });
  }

  async executeCommand(serverId: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = this.connections.get(serverId);
      
      if (!conn) {
        reject(new Error(`No connection found for server: ${serverId}`));
        return;
      }

      let output = '';
      let errorOutput = '';

      conn.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        stream.on('close', (code: number) => {
          if (code !== 0 && errorOutput) {
            resolve(`Command exited with code ${code}\n\nError output:\n${errorOutput}\n\nStandard output:\n${output}`);
          } else {
            resolve(output || '(No output)');
          }
        });

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      });
    });
  }

  async executeStreamingCommand(
    serverId: string, 
    command: string, 
    onData: (data: string) => void, 
    onError: (error: string) => void,
    onClose: (code: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const conn = this.connections.get(serverId);
      
      if (!conn) {
        reject(new Error(`No connection found for server: ${serverId}`));
        return;
      }

      conn.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        // Return the stream so it can be controlled externally
        resolve(stream);

        stream.on('close', (code: number) => {
          onClose(code);
        });

        stream.on('data', (data: Buffer) => {
          onData(data.toString());
        });

        stream.stderr.on('data', (data: Buffer) => {
          onError(data.toString());
        });
      });
    });
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (conn) {
      conn.end();
      this.connections.delete(serverId);
      console.log(`Disconnected from server: ${serverId}`);
    }
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }
}