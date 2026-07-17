import TelegramBot from 'node-telegram-bot-api';

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

  async sendWithTyping(bot: TelegramBot, chatId: number, message: string, options?: any) {
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
      return `\`\`\`\n${truncated}\n\`\`\`\n\n📄 _Output truncated (${lines.length - maxLines} more lines)_`;
    }
    
    return `\`\`\`\n${output}\n\`\`\``;
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

  getErrorMessage(error: any): string {
    const errorMessages: { [key: string]: string } = {
      'ECONNREFUSED': '🔌 Oops! Connection refused. Is the server taking a nap? 😴',
      'ETIMEDOUT': '⏱️ Connection timed out... The server is playing hard to get! 🙈',
      'ENOTFOUND': '🔍 Server not found! Did it go on vacation? 🏖️',
      'Authentication failed': '🔐 Wrong password! The server said "You shall not pass!" 🧙‍♂️',
      'EHOSTUNREACH': '🌐 Can\'t reach the host. Check if your internet is having a bad day! 📡',
      'ECONNRESET': '🔄 Connection reset! The server just rage-quit on us! 😤',
      'Permission denied': '🚫 Permission denied! You need the secret handshake! 🤝',
      'No such file': '📁 404: File not found. It\'s hiding really well! 🕵️‍♂️',
      'Command not found': '🤷 Command not found. Did you make a typo? We all do! 😊'
    };

    const errorString = error.toString();
    
    for (const [key, message] of Object.entries(errorMessages)) {
      if (errorString.includes(key)) {
        return message;
      }
    }
    
    // Fallback with random funny messages
    const fallbacks = [
      `❌ Whoopsie! ${error.message || errorString}`,
      `💥 Houston, we have a problem: ${error.message || errorString}`,
      `🙊 Oh snap! ${error.message || errorString}`,
      `🤖 Error detected, captain: ${error.message || errorString}`,
      `🎪 The circus encountered: ${error.message || errorString}`
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  createQuickCommands(): any {
    return {
      reply_markup: {
        keyboard: [
          ['📁 Show Files', '💾 Check Space'],
          ['🖥️ System Stats', '🏃‍♂️ What\'s Running?'],
          ['🌍 Network Check', '🧠 Memory Info'],
          ['⚙️ Settings', '🆘 Need Help?'],
          ['👋 Bye Server']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  createServerKeyboard(servers: Array<{id: string, name: string, connected: boolean}>): any {
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

  formatServerInfo(server: any, isConnected: boolean): string {
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

  createCommandHistoryKeyboard(history: string[]): any {
    const keyboard = history.slice(-5).map(cmd => [{
      text: `📜 ${cmd.substring(0, 30)}${cmd.length > 30 ? '...' : ''}`,
      callback_data: `history_${Buffer.from(cmd).toString('base64').substring(0, 60)}`
    }]);
    
    return { inline_keyboard: keyboard };
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