# Tracking System - Ship24 & 17Track Integration

A modern shipment tracking system with a Next.js frontend, Node.js backend, and Telegram integration.

## Features
-   Tracking with Ship24 and 17Track APIs.
-   Auto-detection of carriers (SF Express, YunExpress, YTO, ZTO, etc.).
-   Telegram Bot for notifications and tracking.
-   Admin Panel for settings and API configuration.
-   Responsive Dashboard with analytics.

---

## Installation Guide (Ubuntu)

This guide assumes you have a clean Ubuntu installation (20.04 or 22.04).

### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js & npm
We recommend using Node.js v18 or later.
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Install SQLite3
```bash
sudo apt install -y sqlite3
```

### 4. Clone Repository
```bash
git clone YOUR_REPO_URL
cd tracking-system
```

### 5. Install Dependencies
Install dependencies for both frontend and backend.
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 6. Setup Database
The database will be automatically created on first run using `database/schema.sql`.

### 7. Run with PM2 (Recommended for Production)
Install PM2 to keep the services running in the background.
```bash
sudo npm install -g pm2
```

#### Run Backend
```bash
cd ~/tracking-system/backend
pm2 start index.js --name "tracking-backend"
pm2 start worker.js --name "tracking-worker"
```

#### Run Frontend
```bash
cd ~/tracking-system/frontend
npm run build
pm2 start npm --name "tracking-frontend" -- start
```

### 8. Access the Application
-   Frontend: `http://your-server-ip:3000`
-   Admin Panel: `http://your-server-ip:3000/settings`

### 9. Telegram Bot Setup
1.  Talk to [@BotFather](https://t.me/BotFather) to create a new bot and get the Token.
2.  Go to the Admin Panel in your web app.
3.  Enter the **Telegram Bot Token**.
4.  The bot will automatically initialize. Search for your bot on Telegram and type `/start`.

---

## Technical Stack
-   **Frontend:** Next.js (Tailwind CSS, Lucide React, Axios).
-   **Backend:** Node.js (Express, SQLite3, node-cron, node-telegram-bot-api).
-   **Database:** SQLite3.
-   **APIs:** Ship24, 17Track.
