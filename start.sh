#!/bin/bash

# Telegram SSH Bot Quick Start Script

echo "🚀 Telegram SSH Bot - Quick Start"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  Please edit .env file with your credentials:"
    echo "   - TELEGRAM_BOT_TOKEN from @BotFather"
    echo "   - SSH server credentials"
    echo ""
    echo "Then run this script again!"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build
echo ""

# Start the bot
echo "🤖 Starting Telegram SSH Bot..."
echo "================================"
npm start