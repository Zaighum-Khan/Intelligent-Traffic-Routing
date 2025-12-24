#!/bin/zsh
echo "🚀 Starting Intelligent Traffic Routing System..."
echo "=================================================="

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "❌ Frontend dependencies not found!"
    echo "📦 Please run ./setup_mac.sh first"
    exit 1
fi

# Kill any existing processes on these ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# Start Python backend
echo ""
echo "🐍 Starting Python backend on http://localhost:8000"
cd backend
python3.11 main.py > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 3

# Check if backend is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ Backend failed to start."
    echo "📋 Error details:"
    echo ""
    cat backend.log
    echo ""
    echo "💡 Common fixes:"
    echo "   - Make sure Python packages are installed: pip3 install -r backend/requirements.txt"
    echo "   - Check if port 8000 is available: lsof -ti:8000"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend is running!"

# Start React frontend
echo ""
echo "⚛️  Starting React frontend on http://localhost:3000"
cd frontend
BROWSER=none npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Application is starting!"
echo ""
echo "   🌐 Backend:  http://localhost:8000"
echo "   🌐 Frontend: http://localhost:3000"
echo ""
echo "⏳ Frontend is starting... (takes ~30 seconds)"
echo "   Your browser will open automatically"
echo ""
echo "📋 To view logs:"
echo "   tail -f backend.log"
echo "   tail -f frontend.log"
echo ""
echo "🛑 To stop: Press Ctrl+C or run ./stop_mac.sh"
echo ""

# Create stop script
cat > stop_mac.sh << 'EOF'
#!/bin/zsh
echo "🛑 Stopping application..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
echo "✅ Stopped!"
EOF
chmod +x stop_mac.sh

# Wait for interrupt
trap "lsof -ti:8000 | xargs kill -9 2>/dev/null; lsof -ti:3000 | xargs kill -9 2>/dev/null; exit" INT TERM
wait


### `stop_mac.sh` (Auto-generated)

#!/bin/zsh
echo "🛑 Stopping application..."
kill $(lsof -ti:8000) 2>/dev/null
kill $(lsof -ti:3000) 2>/dev/null
echo "✅ Stopped!"
