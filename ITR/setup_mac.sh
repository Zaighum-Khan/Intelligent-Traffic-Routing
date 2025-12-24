#!/bin/zsh
echo "🚀 Intelligent Traffic Routing System - Mac Setup"
echo "=================================================="

# Check if Python is installed
if ! command -v python3.11 &> /dev/null; then
    echo "❌ Python 3 is not installed."
    echo "📥 Install from: https://www.python.org/downloads/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "📥 Install from: https://nodejs.org/"
    exit 1
fi

echo ""
echo "📦 Installing Python dependencies globally..."
cd backend || exit
pip3 install --upgrade pip
pip3 install -r requirements.txt
cd ..

echo ""
echo "📦 Setting up React frontend..."
cd frontend || exit
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To run the application:"
echo "   ./run_mac.sh"
echo ""
