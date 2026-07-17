import { Client as SSHClient, ClientChannel, ConnectConfig } from 'ssh2';
import { createHash } from 'crypto';
import fs from 'fs';
import { SSHConfig } from './types';

export interface ConnectResult {
  /** SHA-256 fingerprint of the server's host key, for trust-on-first-use pinning. */
  hostKeyFingerprint?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}

const CONNECT_TIMEOUT_MS = 15_000;
const KEEPALIVE_INTERVAL_MS = 10_000;
const KEEPALIVE_COUNT_MAX = 3;
const MAX_OUTPUT_BYTES = 100_000;
const COMMAND_TIMEOUT_MS = 60_000;

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

  async executeCommand(serverId: string, command: string): Promise<CommandResult> {
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

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let capturedBytes = 0;
        let truncated = false;
        let settled = false;

        const appendOutput = (data: Buffer, destination: Buffer[]): void => {
          const remainingBytes = MAX_OUTPUT_BYTES - capturedBytes;
          if (remainingBytes <= 0) {
            truncated = true;
            return;
          }

          if (data.length > remainingBytes) {
            destination.push(data.subarray(0, remainingBytes));
            capturedBytes += remainingBytes;
            truncated = true;
            return;
          }

          destination.push(data);
          capturedBytes += data.length;
        };

        const buildResult = (exitCode: number | null, timedOut: boolean): CommandResult => ({
          stdout: Buffer.concat(stdoutChunks).toString(),
          stderr: Buffer.concat(stderrChunks).toString(),
          exitCode,
          timedOut,
          truncated
        });

        const commandTimer = setTimeout(() => {
          if (settled) return;

          settled = true;
          clearTimeout(commandTimer);

          try {
            stream.signal('KILL');
          } catch {
            // The channel may already be closing; still force it closed below.
          }

          try {
            stream.close();
          } catch {
            // Resolve with the captured output even if the channel already closed.
          }

          resolve(buildResult(null, true));
        }, COMMAND_TIMEOUT_MS);

        stream.on('close', (code: number, _signal?: string) => {
          if (settled) return;

          settled = true;
          clearTimeout(commandTimer);
          resolve(buildResult(code, false));
        });

        stream.on('data', (data: Buffer) => {
          appendOutput(data, stdoutChunks);
        });

        stream.stderr.on('data', (data: Buffer) => {
          appendOutput(data, stderrChunks);
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
