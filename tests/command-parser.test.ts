import { beforeAll, describe, expect, it } from 'vitest';
import type { CommandParser as CommandParserType } from '../src/command-parser';

let parser: CommandParserType;

beforeAll(async () => {
  delete process.env.OPENAI_API_KEY;
  const { CommandParser } = await import('../src/command-parser');
  parser = new CommandParser();
});

describe('CommandParser', () => {
  it.each([
    ['/start', { type: 'system', command: '/start' }],
    ['/settings', { type: 'system', command: '/settings' }]
  ] as const)('parses system command %s', async (message, expected) => {
    expect(await parser.parse(message)).toEqual(expected);
  });

  it.each([
    ['ls -la', 'ls -la'],
    ['run docker ps -a', 'docker ps -a'],
    ['"ps aux | grep node"', 'ps aux | grep node']
  ] as const)('extracts bash command from %j', async (message, command) => {
    expect(await parser.parse(message)).toEqual({ type: 'bash', command });
  });

  it('uses pattern suggestions for a file-listing intent', async () => {
    const result = await parser.parse('show me the files');

    expect(result.type).toBe('bash');
    expect(result.command).toBe('ls -la');
    expect(result.suggestions).toEqual(['ls -la', 'ls -lah', 'find . -type f', 'cat', 'less']);
  });

  it('returns unknown for unrecognized gibberish', async () => {
    expect(await parser.parse('asdfqwer zxcv')).toEqual({
      type: 'unknown',
      intent: 'asdfqwer zxcv'
    });
  });
});
