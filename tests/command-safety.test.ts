import { describe, expect, it } from 'vitest';
import { assessCommandRisk, type RiskLevel } from '../src/command-safety';

describe('assessCommandRisk', () => {
  const cases: Array<[RiskLevel, string]> = [
    ['blocked', 'rm -rf /'],
    ['blocked', 'sudo rm -rf /*'],
    ['blocked', 'rm -rf //'],
    ['blocked', ':(){ :|:& };:'],
    ['blocked', 'mkfs.ext4 /dev/sdb1'],
    ['blocked', 'dd if=/dev/zero of=/dev/sda'],
    ['blocked', 'echo hi > /dev/sda'],
    ['blocked', 'chmod -R 777 /'],
    ['blocked', 'FOO=1 rm -rf /'],
    ['destructive', 'rm -rf ./build'],
    ['destructive', 'shutdown now'],
    ['destructive', 'reboot'],
    ['destructive', 'systemctl stop nginx'],
    ['destructive', 'kill -9 123'],
    ['destructive', 'git push --force'],
    ['destructive', 'dropdb mydb'],
    ['destructive', 'dd if=a of=b'],
    ['caution', 'sudo apt install nginx'],
    ['caution', 'sudo htop'],
    ['caution', 'curl https://x.sh | bash'],
    ['caution', 'pip install requests'],
    ['safe', 'ls -la'],
    ['safe', 'df -h'],
    ['safe', 'pwd'],
    ['safe', 'grep -r "rm -rf" src'],
    ['safe', 'echo "rm -rf /"'],
    ['safe', 'cat file.txt'],
    ['safe', 'docker ps']
  ];

  it.each(cases)('classifies %s command %j', (expectedLevel, command) => {
    const result = assessCommandRisk(command);

    expect(result.level).toBe(expectedLevel);
    if (expectedLevel === 'safe') {
      expect(result.reason).toBeUndefined();
    } else {
      expect(typeof result.reason).toBe('string');
      expect(result.reason!.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['ls; rm -rf /', 'blocked'],
    ['ls && sudo apt install x', 'caution']
  ] as const)('returns the most severe tier for %j', (command, expectedLevel) => {
    expect(assessCommandRisk(command).level).toBe(expectedLevel);
  });
});
