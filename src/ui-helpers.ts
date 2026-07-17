import TelegramBot, { InlineKeyboardMarkup } from 'node-telegram-bot-api';
import { ServerConfig } from './types';

/** Options accepted by TelegramBot.sendMessage (derived so it tracks the library version). */
type SendMessageOptions = Parameters<TelegramBot['sendMessage']>[2];

export class UIHelpers {
  getRandomEmoji(): string {
    const emojis = ['🎉', '🚀', '⚡', '🌟', '✨', '🎯', '🔥', '💫', '🎪', '🎭'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }
  
  getTimeOfDayGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Good morning';
    if (hour < 17) return '🌤️ Good afternoon';
    if (hour < 22) return '🌙 Good evening';
    return '🌃 Working late?';
  }

  async sendWithTyping(bot: TelegramBot, chatId: number, message: string, options?: SendMessageOptions) {
    // Send typing indicator
    await bot.sendChatAction(chatId, 'typing');
    
    // Calculate typing time based on message length (50ms per character, max 3 seconds)
    const typingTime = Math.min(message.length * 50, 3000);
    
    // Keep typing indicator active
    const typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }, 2000);
    
    // Wait for "typing" effect
    await new Promise(resolve => setTimeout(resolve, typingTime));
    
    // Clear typing indicator
    clearInterval(typingInterval);
    
    // Send the message
    return bot.sendMessage(chatId, message, options);
  }

  formatCommandOutput(output: string): string {
    // Limit output length and add formatting
    const lines = output.split('\n');
    const maxLines = 50;
    
    if (lines.length > maxLines) {
      const truncated = lines.slice(0, maxLines).join('\n');
      return `\`\`\`\n${this.escapeForCodeBlock(truncated)}\n\`\`\`\n\n📄 _Output truncated (${lines.length - maxLines} more lines)_`;
    }
    
    return `\`\`\`\n${this.escapeForCodeBlock(output)}\n\`\`\``;
  }

  /** Escapes text so it is safe inside a Markdown (legacy) triple-backtick code block. */
  escapeForCodeBlock(text: string): string {
    // Modifier letter grave accent preserves readability without allowing a fence to close.
    const escaped = text.replace(/`/g, 'ˋ');
    const trailingBackslashCount = escaped.match(/\\+$/)?.[0].length ?? 0;

    return trailingBackslashCount % 2 === 1 ? escaped.slice(0, -1) : escaped;
  }

  /**
   * Splits an already-formatted message into chunks that each fit Telegram's
   * 4096-char limit, breaking on newlines where possible. If a single line
   * exceeds the limit it is hard-split. Returns at least one chunk.
   */
  chunkForTelegram(text: string, maxLength = 4000): string[] {
    if (!Number.isInteger(maxLength) || maxLength <= 0) {
      throw new RangeError('maxLength must be a positive integer');
    }

    if (text.length === 0) return [''];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLength) {
      const newlineIndex = remaining.lastIndexOf('\n', maxLength - 1);
      const splitIndex = newlineIndex >= 0 ? newlineIndex + 1 : maxLength;

      chunks.push(remaining.slice(0, splitIndex));
      remaining = remaining.slice(splitIndex);
    }

    chunks.push(remaining);
    return chunks;
  }

  createProgressBar(progress: number, total: number = 100): string {
    const percentage = Math.round((progress / total) * 100);
    const filled = Math.round((progress / total) * 10);
    const empty = 10 - filled;
    
    // Different styles based on progress
    if (percentage < 30) {
      return `🔴${'▓'.repeat(filled)}${'░'.repeat(empty)} ${percentage}% 🐌`;
    } else if (percentage < 60) {
      return `🟡${'▓'.repeat(filled)}${'░'.repeat(empty)} ${percentage}% 🚶`;
    } else if (percentage < 90) {
      return `🟢${'▓'.repeat(filled)}${'░'.repeat(empty)} ${percentage}% 🏃`;
    } else {
      return `✨${'▓'.repeat(filled)}${'░'.repeat(empty)} ${percentage}% 🚀`;
    }
  }

  getRandomLoadingMessage(): string {
    const messages = [
      '🔄 Processing your request...',
      '⚡ Working on it, chief!',
      '🚀 Executing command at warp speed...',
      '💫 Almost there, hold tight!',
      '🔮 Making magic happen... *waves wand*',
      '⏳ Just a sec, brewing some digital coffee...',
      '🎯 On it like a bonnet!',
      '🌟 Processing faster than light...',
      '🎪 Juggling some bits and bytes...',
      '🎨 Painting your results...',
      '🎭 Performing command wizardry...',
      '🎪 The hamsters are spinning the wheels...',
      '🍕 Cooking up your results...',
      '🎸 Rocking your command...',
      '🦾 Flexing my digital muscles...',
      '🎮 Loading your command... 99%...',
      '🌈 Following the rainbow to your data...',
      '🚁 Deploying command helicopters...',
      '🎬 Action! Running your scene...',
      '🏃‍♂️ Sprint mode activated!'
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  getErrorMessage(error: unknown): string {
    const errorString = String(error);
    const errorDetail =
      error instanceof Error ? error.message : errorString;

    const errorMessages: { [key: string]: string } = {
      'ECONNREFUSED': '🔌 Oops! Connection refused. Is the server taking a nap? 😴',
      'ETIMEDOUT': '⏱️ Connection timed out... The server is playing hard to get! 🙈',
      'ENOTFOUND': '🔍 Server not found! Did it go on vacation? 🏖️',
      'Authentication failed': '🔐 Wrong password! The server said "You shall not pass!" 🧙‍♂️',
      'Host verification failed': '🕵️ The server\'s host key changed since last time — possible MITM, connection refused! Remove the server and re-add it if the change is expected.',
      'EHOSTUNREACH': '🌐 Can\'t reach the host. Check if your internet is having a bad day! 📡',
      'ECONNRESET': '🔄 Connection reset! The server just rage-quit on us! 😤',
      'Permission denied': '🚫 Permission denied! You need the secret handshake! 🤝',
      'No such file': '📁 404: File not found. It\'s hiding really well! 🕵️‍♂️',
      'Command not found': '🤷 Command not found. Did you make a typo? We all do! 😊'
    };

    for (const [key, message] of Object.entries(errorMessages)) {
      if (errorString.includes(key)) {
        return message;
      }
    }

    // Fallback with random funny messages
    const fallbacks = [
      `❌ Whoopsie! ${errorDetail}`,
      `💥 Houston, we have a problem: ${errorDetail}`,
      `🙊 Oh snap! ${errorDetail}`,
      `🤖 Error detected, captain: ${errorDetail}`,
      `🎪 The circus encountered: ${errorDetail}`
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  createQuickCommands(): SendMessageOptions {
    const rows = [
      ['📁 Show Files', '💾 Check Space'],
      ['🖥️ System Stats', '🏃‍♂️ What\'s Running?'],
      ['🌍 Network Check', '🧠 Memory Info'],
      ['⚙️ Settings', '🆘 Need Help?'],
      ['👋 Bye Server']
    ];
    return {
      reply_markup: {
        keyboard: rows.map(row => row.map(text => ({ text }))),
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  createServerKeyboard(servers: Array<{id: string, name: string, connected: boolean}>): InlineKeyboardMarkup {
    const keyboard = servers.map(server => [{
      text: `${server.connected ? '🟢' : '⚪'} ${server.name}`,
      callback_data: server.connected ? `status_${server.id}` : `connect_${server.id}`
    }]);

    keyboard.push([
      { text: '➕ Add New Server', callback_data: 'add_server' },
      { text: '🔄 Refresh', callback_data: 'refresh_servers' }
    ]);

    return { inline_keyboard: keyboard };
  }

  formatServerInfo(server: ServerConfig, isConnected: boolean): string {
    const statusEmoji = isConnected ? '🟢' : '⚪';
    const statusText = isConnected ? 'Online & Ready!' : 'Sleeping...';
    const serverEmojis = ['🖥️', '💻', '🖲️', '⚡', '🔧'];
    const randomServerEmoji = serverEmojis[Math.floor(Math.random() * serverEmojis.length)];
    
    return `
${randomServerEmoji} **${server.name}**
${statusEmoji} _${statusText}_

📍 **Address:** \`${server.config.host}\`
👤 **Login:** \`${server.config.username}\`
🔌 **Port:** \`${server.config.port || 22}\`
🔐 **Security:** ${server.config.password ? '🔑 Password' : '🗝️ SSH Key'}
${isConnected ? '\n⚡ _Ready for your commands!_' : '\n💤 _Click to wake up!_'}
    `.trim();
  }

  formatWelcomeMessage(userName?: string): string {
    const greeting = userName ? `${userName}` : 'friend';
    const vibes = ['🌈', '🎉', '⚡', '✨', '🚀', '🌟', '💫', '🔥'];
    const randomVibe = vibes[Math.floor(Math.random() * vibes.length)];
    
    return `
${randomVibe} **Yo ${greeting}! Welcome to VibeSSH!** ${randomVibe}

I'm your **server bestie** with mad SSH skills 🤖✨

💬 Just vibe with me:
• _"show files"_ → boom, files! 📁
• _"disk space?"_ → instant stats! 💾
• _"what's running"_ → process party! 🎉

🎮 Or tap the magic buttons below ⬇️

Let's make servers fun! 🌈
    `.trim();
  }

  createLoadingAnimation(stage: number = 0): string {
    const animations = [
      ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
      ['⚡', '⚡⚡', '⚡⚡⚡', '⚡⚡', '⚡'],
      ['🎯', '🎯 ', '🎯  ', '🎯   ', '  🎯 ', '   🎯', '  🎯 ', ' 🎯  '],
      ['▱▱▱', '▰▱▱', '▰▰▱', '▰▰▰', '▱▰▰', '▱▱▰', '▱▱▱'],
      ['🚀    ', ' 🚀   ', '  🚀  ', '   🚀 ', '    🚀', '   🚀 ', '  🚀  ', ' 🚀   ']
    ];
    
    const animationSet = animations[Math.floor(stage / 10) % animations.length];
    return animationSet[stage % animationSet.length];
  }
}
