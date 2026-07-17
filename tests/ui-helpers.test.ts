import { describe, expect, it } from 'vitest';
import { UIHelpers } from '../src/ui-helpers';

const ui = new UIHelpers();

describe('UIHelpers', () => {
  describe('escapeForCodeBlock', () => {
    it.each([
      ['plain text', 'plain text'],
      ['path\\', 'path']
    ])('transforms %j into %j', (input, expected) => {
      expect(ui.escapeForCodeBlock(input)).toBe(expected);
    });

    it('removes every U+0060 backtick character', () => {
      const escaped = ui.escapeForCodeBlock('before `code` after');

      expect(escaped).not.toContain('`');
      expect(escaped).toBe('before ˋcodeˋ after');
    });
  });

  describe('chunkForTelegram', () => {
    it('splits long multiline text losslessly within the limit', () => {
      const original = 'alpha\nbeta\ngamma\ndelta';
      const chunks = ui.chunkForTelegram(original, 8);

      expect(chunks.every(chunk => chunk.length <= 8)).toBe(true);
      expect(chunks.join('')).toBe(original);
    });

    it('returns one empty chunk for empty input', () => {
      expect(ui.chunkForTelegram('')).toEqual(['']);
    });

    it('hard-splits a single line longer than the limit', () => {
      expect(ui.chunkForTelegram('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    });

    it.each([0, -1])('throws RangeError for maxLength %i', maxLength => {
      expect(() => ui.chunkForTelegram('text', maxLength)).toThrow(RangeError);
    });
  });

  describe('formatCommandOutput', () => {
    it('wraps output of at most 50 lines in a triple-backtick fence', () => {
      expect(ui.formatCommandOutput('line one\nline two')).toBe('```\nline one\nline two\n```');
    });

    it('marks output longer than 50 lines as truncated', () => {
      const output = Array.from({ length: 51 }, (_, index) => `line ${index + 1}`).join('\n');

      expect(ui.formatCommandOutput(output)).toContain('_Output truncated');
    });
  });

  describe('getErrorMessage', () => {
    it('maps ECONNREFUSED to its friendly message', () => {
      expect(ui.getErrorMessage(new Error('connect ECONNREFUSED 127.0.0.1'))).toBe(
        '🔌 Oops! Connection refused. Is the server taking a nap? 😴'
      );
    });

    it.each([
      [new Error('custom failure'), 'custom failure'],
      ['boom', 'boom']
    ])('includes unknown error detail in the fallback', (error, detail) => {
      expect(ui.getErrorMessage(error)).toContain(detail);
    });
  });

  it.each([
    [0, '0%'],
    [100, '100%']
  ] as const)('renders progress %i with %s', (progress, percentage) => {
    expect(ui.createProgressBar(progress)).toContain(percentage);
  });
});
