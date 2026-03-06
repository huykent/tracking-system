@echo off
echo ==============================================
echo Installing Tracking System Dependencies...
echo ==============================================

if not exist node_modules\concurrently (
  echo [1/3] Installing root dependencies...
  call npm install concurrently
)

echo [2/3] Installing backend dependencies...
cd backend
call npm install sqlite3
call npm uninstall pg redis bullmq
cd ..

echo [3/3] Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo ==============================================
echo Starting Smart Logistics Tracking Platform...
echo ==============================================
npx concurrently "cd backend && node index.js" "cd frontend && npm run dev"
