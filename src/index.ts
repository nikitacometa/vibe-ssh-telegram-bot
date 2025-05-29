import { TelegramMCPBot } from './bot';
import { config } from './config';

async function main() {
  // Validate configuration
  if (!config.telegramBotToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env file');
    console.log('Please create a .env file with your bot token:');
    console.log('TELEGRAM_BOT_TOKEN=your_bot_token_here');
    process.exit(1);
  }

  // Create and start bot
  const bot = new TelegramMCPBot();
  
  try {
    await bot.start();
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});