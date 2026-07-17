/** Risk assigned to a shell command. */
export type RiskLevel = 'safe' | 'caution' | 'destructive' | 'blocked';

/** A command risk level and, for non-safe commands, a short explanation. */
export interface RiskAssessment {
  level: RiskLevel;
  reason?: string;
}

const SEVERITY: Record<RiskLevel, number> = {
  safe: 0,
  caution: 1,
  destructive: 2,
  blocked: 3
};

const BLOCK_DEVICE = String.raw`\/dev\/(?:sd[a-z]\d*|hd[a-z]\d*|vd[a-z]\d*|xvd[a-z]\d*|nvme\d+n\d+(?:p\d+)?|mmcblk\d+(?:p\d+)?|loop\d+|md\d+|dm-\d+|mapper\/\S+|disk\/by-(?:id|path)\/\S+)`;
const BLOCK_DEVICE_RE = new RegExp(`^${BLOCK_DEVICE}$`);
const REDIRECT_TO_BLOCK_RE = new RegExp(`(?:^|\\s)\\d*>>?\\s*${BLOCK_DEVICE}(?:\\s|$)`);

/**
 * Replaces quoted text with spaces so examples printed by commands such as
 * `echo` and `grep` are not treated as executable operations. This is only a
 * lexical best effort, not a shell parser: nested shells, expansions, escaped
 * newlines, and unusual quoting can hide behavior and should be handled by a
 * real parser or sandbox when stronger guarantees are required.
 */
function maskQuotedText(input: string): string {
  let quote: "'" | '"' | undefined;
  let escaped = false;
  let output = '';

  for (const character of input) {
    if (escaped) {
      output += quote ? ' ' : character;
      escaped = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      output += quote ? ' ' : character;
      escaped = true;
      continue;
    }
    if (quote) {
      output += ' ';
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      output += ' ';
      continue;
    }
    output += character;
  }

  return output;
}

function assessment(level: Exclude<RiskLevel, 'safe'>, reason: string): RiskAssessment {
  return { level, reason };
}

function commandContext(segment: string): { words: string[]; usedSudo: boolean } {
  const words = segment.trim().split(/\s+/).filter(Boolean);
  while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();

  let usedSudo = false;
  if (words[0] === 'sudo') {
    usedSudo = true;
    words.shift();
    while (words[0]?.startsWith('-')) {
      const option = words.shift();
      if (option === '-u' || option === '-g' || option === '-h' || option === '-p') words.shift();
    }
    while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
  }

  return { words, usedSudo };
}

function hasShortFlag(words: string[], flag: string): boolean {
  return words.some(
    word => word.startsWith('-') && !word.startsWith('--') && word.slice(1).includes(flag)
  );
}

function isRootTarget(word: string): boolean {
  return /^\/{1,}$/.test(word) || /^\/{1,}\*$/.test(word) || /^\/{1,}\.\/{0,}$/.test(word);
}

function assessSegment(segment: string): RiskAssessment {
  const { words, usedSudo } = commandContext(segment);
  const command = words[0] ?? '';
  const args = words.slice(1);
  const recursive =
    hasShortFlag(args, 'r') || hasShortFlag(args, 'R') || args.includes('--recursive');
  const forced = hasShortFlag(args, 'f') || args.includes('--force');

  if (command === 'rm' && recursive && forced && args.some(isRootTarget)) {
    return assessment('blocked', 'Recursive forced deletion targets the filesystem root');
  }
  if (/^mkfs(?:\.[A-Za-z0-9_-]+)?$/.test(command)) {
    return assessment('blocked', 'Filesystem formatting is not allowed');
  }
  if (
    command === 'dd' &&
    args.some(arg => arg.startsWith('of=') && BLOCK_DEVICE_RE.test(arg.slice(3)))
  ) {
    return assessment('blocked', 'Writing directly to a block device is not allowed');
  }
  if (command === 'shred' && args.some(arg => BLOCK_DEVICE_RE.test(arg))) {
    return assessment('blocked', 'Shredding a block device is not allowed');
  }
  if (REDIRECT_TO_BLOCK_RE.test(segment)) {
    return assessment('blocked', 'Redirecting output to a block device is not allowed');
  }
  if ((command === 'chmod' || command === 'chown') && recursive && args.some(isRootTarget)) {
    return assessment('blocked', `Recursive ${command} on the filesystem root is not allowed`);
  }
  if (command === 'mv' && args.slice(0, -1).some(isRootTarget)) {
    return assessment('blocked', 'Moving the filesystem root is not allowed');
  }
  if (command === 'init' && (args[0] === '0' || args[0] === '6')) {
    return assessment('blocked', 'System-killing init runlevel is not allowed');
  }

  if (command === 'rm' && (recursive || forced))
    return assessment('destructive', 'Forced or recursive deletion');
  if (command === 'dd')
    return assessment('destructive', 'Low-level data copying can overwrite data');
  if (['shutdown', 'reboot', 'halt', 'poweroff'].includes(command))
    return assessment('destructive', 'Command stops or restarts the system');
  if (command === 'systemctl' && ['stop', 'disable', 'mask'].includes(args[0] ?? ''))
    return assessment('destructive', 'Command disables or stops a service');
  if (['kill', 'pkill', 'killall'].includes(command))
    return assessment('destructive', 'Command terminates processes');
  if (
    (command === 'iptables' && (args.includes('-F') || args.includes('--flush'))) ||
    (command === 'nft' && args.includes('flush'))
  )
    return assessment('destructive', 'Command flushes firewall rules');
  if (command === 'truncate') return assessment('destructive', 'Command truncates file data');
  if (['userdel', 'groupdel'].includes(command))
    return assessment('destructive', 'Command deletes an account or group');
  if (command === 'crontab' && args.includes('-r'))
    return assessment('destructive', 'Command removes a crontab');
  if (
    command === 'docker' &&
    ((args[0] === 'system' && args[1] === 'prune') || ['rm', 'rmi'].includes(args[0] ?? ''))
  )
    return assessment('destructive', 'Command removes Docker resources');
  if (
    command === 'git' &&
    args[0] === 'push' &&
    (args.includes('--force') || args.includes('-f') || args.includes('--force-with-lease'))
  )
    return assessment('destructive', 'Forced Git push can overwrite remote history');
  if (command === 'dropdb') return assessment('destructive', 'Command drops a database');

  const packageManagers = /^(?:apt|apt-get|yum|dnf|apk|npm|pip|pip3)$/;
  const packageActions = /^(?:install|remove|uninstall|purge|erase)$/;
  if (packageManagers.test(command) && args.some(arg => packageActions.test(arg)))
    return assessment('caution', 'Command changes installed packages');
  if (usedSudo) return assessment('caution', 'Command runs with elevated privileges');

  return { level: 'safe' };
}

/**
 * Classifies a composed shell command and returns its most severe risk.
 * Every non-safe result includes a short reason suitable for confirmation UI.
 */
export function assessCommandRisk(command: string): RiskAssessment {
  const masked = maskQuotedText(command)
    .replace(/[\t\r ]+/g, ' ')
    .trim();

  if (/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(masked)) {
    return assessment('blocked', 'Fork bomb is not allowed');
  }
  let highest: RiskAssessment = { level: 'safe' };
  if (/\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba|da|z|k)?sh\b/.test(masked)) {
    highest = assessment('caution', 'Downloaded content is piped directly into a shell');
  }

  for (const segment of masked.split(/\s*(?:&&|\|\||[;|\n])\s*/)) {
    if (!segment) continue;
    const current = assessSegment(segment);
    if (SEVERITY[current.level] > SEVERITY[highest.level]) highest = current;
    if (highest.level === 'blocked') break;
  }
  return highest;
}
