import { AICommandAnalyzer } from './ai-command-analyzer';

export interface ParsedCommand {
  type: 'bash' | 'system' | 'unknown';
  command?: string;
  intent?: string;
  suggestions?: string[];
  confidence?: number;
  explanation?: string;
  category?: string;
}

export class CommandParser {
  private aiAnalyzer: AICommandAnalyzer;
  
  constructor() {
    this.aiAnalyzer = new AICommandAnalyzer();
  }
  
  private intentPatterns = [
    // File operations
    { pattern: /(?:list|show|see|display).*(?:files|directories|folder)/i, commands: ['ls -la', 'ls -lah', 'find . -type f'], category: 'files' },
    { pattern: /(?:create|make|new).*(?:file|directory|folder)/i, commands: ['touch', 'mkdir'], category: 'files' },
    { pattern: /(?:delete|remove|rm).*(?:file|directory)/i, commands: ['rm', 'rm -rf', 'rmdir'], category: 'files' },
    { pattern: /(?:copy|cp).*file/i, commands: ['cp', 'cp -r'], category: 'files' },
    { pattern: /(?:move|mv|rename).*file/i, commands: ['mv'], category: 'files' },
    { pattern: /(?:find|search|locate).*file/i, commands: ['find . -name', 'locate', 'grep -r'], category: 'files' },
    
    // System information
    { pattern: /(?:system|os).*(?:info|information|details)/i, commands: ['uname -a', 'cat /etc/os-release', 'hostnamectl'], category: 'system' },
    { pattern: /(?:disk|storage).*(?:space|usage)/i, commands: ['df -h', 'du -sh *', 'lsblk'], category: 'system' },
    { pattern: /(?:memory|ram).*usage/i, commands: ['free -h', 'cat /proc/meminfo'], category: 'system' },
    { pattern: /(?:cpu|processor).*(?:usage|info)/i, commands: ['top', 'htop', 'cat /proc/cpuinfo'], category: 'system' },
    { pattern: /(?:what|which).*(?:processes|running)/i, commands: ['ps aux', 'top', 'htop'], category: 'system' },
    { pattern: /(?:running|active).*(?:processes|services)/i, commands: ['ps aux', 'systemctl list-units --type=service'], category: 'system' },
    { pattern: /(?:current|working).*directory/i, commands: ['pwd'], category: 'system' },
    { pattern: /who.*(?:am i|user)/i, commands: ['whoami', 'id'], category: 'system' },
    
    // Network operations
    { pattern: /(?:network|internet).*(?:connection|connectivity)/i, commands: ['ping -c 4 google.com', 'curl -I google.com'], category: 'network' },
    { pattern: /(?:network|open).*(?:ports|connections)/i, commands: ['netstat -tuln', 'ss -tuln'], category: 'network' },
    { pattern: /(?:ip|network).*(?:address|config)/i, commands: ['ip addr show', 'ifconfig'], category: 'network' },
    { pattern: /(?:download|fetch|get).*(?:file|url)/i, commands: ['wget', 'curl -O'], category: 'network' },
    
    // Service management
    { pattern: /(?:start|stop|restart|status).*service/i, commands: ['systemctl start', 'systemctl stop', 'systemctl restart', 'systemctl status'], category: 'services' },
    { pattern: /(?:docker|container)/i, commands: ['docker ps', 'docker images', 'docker logs'], category: 'docker' },
    { pattern: /(?:git|repository)/i, commands: ['git status', 'git log --oneline', 'git branch'], category: 'git' },
    
    // Package management
    { pattern: /(?:install|update|upgrade).*(?:package|software)/i, commands: ['apt update && apt upgrade', 'yum update', 'npm install'], category: 'packages' },
    { pattern: /(?:search|find).*package/i, commands: ['apt search', 'yum search', 'npm search'], category: 'packages' },
    
    // Log viewing
    { pattern: /(?:view|show|check|read).*(?:logs|log)/i, commands: ['tail -f /var/log/syslog', 'journalctl -f', 'dmesg'], category: 'logs' },
    
    // Text operations
    { pattern: /(?:view|show|read|cat).*(?:file|content)/i, commands: ['cat', 'less', 'head', 'tail'], category: 'text' },
    { pattern: /(?:search|grep|find).*(?:text|string|pattern)/i, commands: ['grep -r', 'find . -type f -exec grep'], category: 'text' },
    { pattern: /(?:edit|modify|change).*file/i, commands: ['nano', 'vim', 'vi'], category: 'text' }
  ];

  private systemCommands = [
    '/start', '/help', '/servers', '/connect', '/disconnect', '/addserver',
    '/removeserver', '/status', '/cancel'
  ];

  async parse(message: string, useAI: boolean = true): Promise<ParsedCommand> {
    const trimmed = message.trim();
    
    // Check if it's a system command
    if (trimmed.startsWith('/')) {
      const command = trimmed.split(' ')[0].toLowerCase();
      if (this.systemCommands.includes(command)) {
        return { type: 'system', command: trimmed };
      }
    }

    // Try to extract explicit bash command
    const bashCommand = this.extractBashCommand(trimmed);
    if (bashCommand) {
      return { type: 'bash', command: bashCommand };
    }

    // Try AI analysis first if available and enabled
    if (useAI && this.aiAnalyzer.isAvailable()) {
      try {
        const aiSuggestion = await this.aiAnalyzer.analyzeIntent(trimmed);
        if (aiSuggestion && aiSuggestion.commands.length > 0) {
          return {
            type: 'bash',
            intent: trimmed,
            command: aiSuggestion.commands[0],
            suggestions: aiSuggestion.commands,
            confidence: aiSuggestion.confidence,
            explanation: aiSuggestion.explanation,
            category: aiSuggestion.category
          };
        }
      } catch (error) {
        console.warn('AI analysis failed, falling back to pattern matching:', error);
      }
    }

    // Fallback to pattern-based analysis
    const analysis = this.analyzeIntent(trimmed);
    if (analysis.suggestions.length > 0) {
      return {
        type: 'bash',
        intent: trimmed,
        command: analysis.suggestions[0],
        suggestions: analysis.suggestions,
        confidence: analysis.confidence
      };
    }

    return { type: 'unknown', intent: trimmed };
  }

  private extractBashCommand(message: string): string | undefined {
    // Look for quoted commands
    const quotedMatch = message.match(/["'](.+?)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }

    // Look for backtick commands
    const backtickMatch = message.match(/`(.+?)`/);
    if (backtickMatch) {
      return backtickMatch[1];
    }

    // Look for explicit command patterns
    const patterns = [
      /(?:run|execute|exec)\s+(.+)/i,
      /(?:please\s+)?(?:can you\s+)?(?:run|execute)\s+(.+)/i,
      /^(ls|pwd|whoami|df|ps|top|free|uptime|date|uname)(?:\s|$)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  private analyzeIntent(message: string): { suggestions: string[], confidence: number } {
    const suggestions: string[] = [];
    let maxConfidence = 0;
    
    // Check against intent patterns
    for (const pattern of this.intentPatterns) {
      if (pattern.pattern.test(message)) {
        suggestions.push(...pattern.commands);
        maxConfidence = Math.max(maxConfidence, 0.8);
      }
    }
    
    // Check for specific keywords and extract context
    const contextualSuggestions = this.extractContextualCommands(message);
    if (contextualSuggestions.length > 0) {
      suggestions.push(...contextualSuggestions);
      maxConfidence = Math.max(maxConfidence, 0.6);
    }
    
    // Remove duplicates and limit suggestions
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 5);
    
    return {
      suggestions: uniqueSuggestions,
      confidence: maxConfidence
    };
  }
  
  private extractContextualCommands(message: string): string[] {
    const lower = message.toLowerCase();
    const commands: string[] = [];
    
    // Extract file/directory names for context
    const fileMatches = message.match(/['"]([^'"]+)['"]|\b(\w+\.\w+)\b/g);
    const filenames = fileMatches?.map(match => match.replace(/['"]/, '')) || [];
    
    // Context-aware suggestions
    if (lower.includes('log') && filenames.length > 0) {
      commands.push(`tail -f ${filenames[0]}`, `cat ${filenames[0]}`);
    }
    
    if (lower.includes('size') || lower.includes('how big')) {
      if (filenames.length > 0) {
        commands.push(`du -sh ${filenames[0]}`, `ls -lh ${filenames[0]}`);
      } else {
        commands.push('du -sh *', 'df -h');
      }
    }
    
    if (lower.includes('permission') || lower.includes('chmod')) {
      if (filenames.length > 0) {
        commands.push(`ls -la ${filenames[0]}`, `chmod 755 ${filenames[0]}`);
      }
    }
    
    if (lower.includes('running') && (lower.includes('on port') || lower.includes('port'))) {
      const portMatch = message.match(/port\s+(\d+)/i);
      if (portMatch) {
        commands.push(`lsof -i :${portMatch[1]}`, `netstat -tuln | grep ${portMatch[1]}`);
      }
    }
    
    if ((lower.includes('using port') || lower.includes('on port')) && !lower.includes('running')) {
      const portMatch = message.match(/port\s+(\d+)/i);
      if (portMatch) {
        commands.push(`lsof -i :${portMatch[1]}`, `netstat -tuln | grep ${portMatch[1]}`);
      } else {
        commands.push('lsof -i', 'netstat -tuln');
      }
    }
    
    // Time-based queries
    if (lower.includes('when') || lower.includes('modified') || lower.includes('changed')) {
      if (filenames.length > 0) {
        commands.push(`stat ${filenames[0]}`, `ls -la ${filenames[0]}`);
      }
    }
    
    return commands;
  }
}