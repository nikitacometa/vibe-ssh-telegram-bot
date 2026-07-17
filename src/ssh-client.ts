import { Client as SSHClient, ClientChannel, ConnectConfig } from 'ssh2';
import { createHash } from 'crypto';
import fs from 'fs';
import { SSHConfig } from './types';

export interface ConnectResult {
  /** SHA-256 fingerprint of the server's host key, for trust-on-first-use pinning. */
  hostKeyFingerprint?: string;
}

const CONNECT_TIMEOUT_MS = 15_000;
const KEEPALIVE_INTERVAL_MS = 10_000;
const KEEPALIVE_COUNT_MAX = 3;

export class SimpleSSHClient {
  private connections: Map<string, SSHClient> = new Map();

  async connect(serverId: string, config: SSHConfig): Promise<ConnectResult> {
    return new Promise((resolve, reject) => {
      const conn = new SSHClient();
      let observedFingerprint: string | undefined;

      conn.on('ready', () => {
        console.log(`SSH connection established to ${config.host}`);
        this.connections.set(serverId, conn);
        resolve({ hostKeyFingerprint: observedFingerprint });
      });

      conn.on('error', (err) => {
        console.error(`SSH connection error: ${err.message}`);
        reject(err);
      });

      // Dead or dropped connections must not linger in the map,
      // otherwise isConnected() lies and commands fail confusingly
      conn.on('close', () => {
        if (this.connections.get(serverId) === conn) {
          this.connections.delete(serverId);
        }
      });

      const connectionConfig: ConnectConfig = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        readyTimeout: CONNECT_TIMEOUT_MS,
        keepaliveInterval: KEEPALIVE_INTERVAL_MS,
        keepaliveCountMax: KEEPALIVE_COUNT_MAX,
        // Trust-on-first-use host key pinning: remember the key on first
        // connect, refuse to connect if it ever changes (possible MITM)
        hostVerifier: (key: Buffer) => {
          observedFingerprint = `SHA256:${createHash('sha256').update(key).digest('base64')}`;
          if (config.hostKeyFingerprint && config.hostKeyFingerprint !== observedFingerprint) {
            console.error(
              `Host key mismatch for ${config.host}: expected ${config.hostKeyFingerprint}, ` +
              `got ${observedFingerprint}. Refusing to connect.`
            );
            return false;
          }
          return true;
        }
      };

      if (config.password) {
        connectionConfig.password = config.password;
      } else if (config.privateKey) {
        // Use the private key content directly
        connectionConfig.privateKey = config.privateKey;
      } else if (config.privateKeyPath) {
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
  ): Promise<ClientChannel> {
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
