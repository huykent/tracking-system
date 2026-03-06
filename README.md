# 🚢 Logistics Tracking Admin Dashboard

A production-ready logistics tracking system with multi-carrier support, real-time updates, and Telegram notifications.

## Stack

| Layer      | Technology                              |
|------------|----------------------------------------|
| Frontend   | Next.js 14, React, TailwindCSS          |
| Backend    | Node.js, Express                        |
| Database   | PostgreSQL (with UUID, JSONB indexes)   |
| Cache      | Redis (ioredis)                         |
| Queue      | BullMQ                                  |
| Scheduler  | node-cron (every 5 min)                 |
| Notify     | Telegram Bot API                        |

---

## Features

- ✅ **Multi-API Tracking** — Ship24, 17Track, Kuaidi100 with automatic fallback
- ✅ **Carrier Auto-Detection** — Regex-based detection for 20+ Chinese & international carriers
- ✅ **Background Queue** — BullMQ workers process tracking updates every 5 minutes
- ✅ **Rate Limit Management** — Daily API limits tracked in Redis, auto-switches to next provider
- ✅ **Telegram Notifications** — New events and delivery confirmations
- ✅ **Admin Panel** — Configure API keys, enable/disable providers, set priorities
- ✅ **Shipments Dashboard** — Statistics, carrier breakdown, daily trend charts
- ✅ **Tracking Timeline** — Visual event history per shipment
- ✅ **Bulk Import** — Add up to 200 tracking numbers at once
- ✅ **Docker-Ready** — Single `docker compose up` to run everything

---

## Quick Start (Ubuntu / Linux)

### 1. Clone & Configure

```bash
git clone https://github.com/huykent/tracking-system.git
cd tracking-system
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **Backend API** on port 4000
- **Background Worker** (BullMQ)
- **Frontend** on port **3000**

Wait ~30 seconds for services to initialize.

### 3. Access the App

- **Dashboard:** http://localhost:3000
- **API Health:** http://localhost:4000/health

### 4. Configure API Keys

Go to **Settings** in the dashboard:

1. Enter your API keys for the tracking providers:
   - **Ship24:** https://ship24.com (get free API key)
   - **17Track:** https://api.17track.net/en/apicenter/dashboard
   - **Kuaidi100:** No key needed for free tier

2. Set provider **Priority** (lower = tries first)
3. Configure your **Telegram Bot** for notifications

---

## Manual Setup (Without Docker)

### Requirements
- Node.js ≥ 18
- PostgreSQL 14+
- Redis 6+

### Backend

```bash
cd backend
npm install
DATABASE_URL=postgresql://user:pass@localhost:5432/tracking_db \
REDIS_URL=redis://localhost:6379 \
npm start
```

### Worker (separate terminal)

```bash
cd backend
NODE_ENV=production \
DATABASE_URL=postgresql://user:pass@localhost:5432/tracking_db \
REDIS_URL=redis://localhost:6379 \
npm run worker
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:4000 \
npm run dev
```

---

## API Endpoints

### Shipments
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/shipments` | List with pagination, filtering, sorting |
| POST   | `/api/shipments` | Add single shipment (auto-detects carrier) |
| POST   | `/api/shipments/bulk` | Bulk import (up to 200) |
| GET    | `/api/shipments/:id` | Get with event timeline |
| PATCH  | `/api/shipments/:id` | Update shipment |
| DELETE | `/api/shipments/:id` | Delete shipment |
| POST   | `/api/shipments/:id/refresh` | Queue immediate tracking update |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/dashboard/stats` | Statistics + queue status |
| GET    | `/api/dashboard/providers` | API provider summary |

### Providers & Settings
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/providers` | List API providers |
| PATCH  | `/api/providers/:name` | Update provider config |
| POST   | `/api/providers/:name/reset` | Reset daily counter |
| GET    | `/api/settings` | Get settings |
| PATCH  | `/api/settings` | Save settings |
| POST   | `/api/settings/telegram/test` | Test Telegram |

---

## Carrier Detection

Supports auto-detecting these carriers from tracking number patterns:

| Carrier | Prefix/Pattern | 17Track Key |
|---------|---------------|-------------|
| SF Express (顺丰) | `SF` + 12-15 digits | 100012 |
| YunExpress (云途) | `YT` + 16 digits | 190008 |
| YTO Express (圆通) | `EN` + 9 digits + `CN` | 190157 |
| ZTO Express (中通) | `773`, `303` prefix | 190455 |
| STO Express (申通) | `36` prefix | 190324 |
| Yunda (韵达) | `YD` + 16 digits | 190341 |
| BEST Express (百世) | `BX` + 12 digits | 190259 |
| J&T Express | `JT` + 12 digits | 190442 |
| Cainiao (菜鸟) | `LP`, `LX` prefix | 190271 |
| 4PX (递四方) | `RE`/`RR` + 9 + `CN` | 190094 |
| China Post | Single letter + 9 + `CN` | 3011 |
| China EMS | `E` + letter + 9 + `CN` | 3013 |
| Yanwen (燕文) | `MH` + 9 + letters | 190012 |
| DHL Express | 22 or 34 digits | 100001 |
| FedEx | 20 digits | 100003 |
| UPS | `1Z` + 16 chars | 100002 |

---

## License
MIT
