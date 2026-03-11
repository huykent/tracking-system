#!/bin/bash
# ============================================================
#  LogTrack - Quick Install Script for Ubuntu 20.04 / 22.04
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

REPO_URL="https://github.com/huykent/tracking-system.git"
APP_DIR="$HOME/tracking-system"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║     LogTrack - Logistics Tracking v2     ║"
echo "║       Quick Install for Ubuntu           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ─── 1. Cập nhật hệ thống ─────────────────────────────────
echo -e "${YELLOW}[1/7] Cập nhật hệ thống...${NC}"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git ca-certificates gnupg lsb-release

# ─── 2. Cài Docker nếu chưa có ───────────────────────────
echo -e "${YELLOW}[2/7] Kiểm tra Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "Đang cài Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}✓ Docker đã cài xong${NC}"
else
    echo -e "${GREEN}✓ Docker đã có sẵn ($(docker --version))${NC}"
fi

# ─── 3. Cài Docker Compose nếu chưa có ──────────────────
echo -e "${YELLOW}[3/7] Kiểm tra Docker Compose...${NC}"
if ! docker compose version &> /dev/null; then
    echo "Cài Docker Compose plugin..."
    sudo apt-get install -y -qq docker-compose-plugin
fi
echo -e "${GREEN}✓ $(docker compose version)${NC}"

# ─── 4. Clone hoặc update repo ───────────────────────────
echo -e "${YELLOW}[4/7] Tải source code...${NC}"
if [ -d "$APP_DIR" ]; then
    echo "Thư mục đã có, đang pull bản mới nhất..."
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
echo -e "${GREEN}✓ Source code đã sẵn sàng tại $APP_DIR${NC}"

# ─── 5. Tạo file .env nếu chưa có ────────────────────────
echo -e "${YELLOW}[5/7] Cấu hình môi trường...${NC}"

if [ ! -f "$APP_DIR/.env" ]; then
cat > "$APP_DIR/.env" << 'EOF'
# ── PostgreSQL ──────────────────────────────
POSTGRES_DB=tracking_db
POSTGRES_USER=tracking_user
POSTGRES_PASSWORD=tracking_pass_change_me

# ── Backend ─────────────────────────────────
DATABASE_URL=postgresql://tracking_user:tracking_pass_change_me@postgres:5432/tracking_db
REDIS_URL=redis://redis:6379
PORT=4000

# ── Frontend ────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000

# ── Webhooks ────────────────────────────────
TRACKINGMORE_WEBHOOK_SECRET=your_webhook_secret_here
EOF
    echo -e "${GREEN}✓ Đã tạo .env (nhớ đổi password!)${NC}"
else
    echo -e "${GREEN}✓ File .env đã tồn tại${NC}"
fi

# ─── 6. Khởi động Docker services ────────────────────────
echo -e "${YELLOW}[6/7] Khởi động dịch vụ...${NC}"
cd "$APP_DIR"

# Dùng env file nếu có
if [ -f ".env" ]; then
    sudo docker compose --env-file .env up -d --build
else
    sudo docker compose up -d --build
fi

echo -e "${GREEN}✓ Tất cả services đang khởi động...${NC}"

# ─── 7. Chờ backend sẵn sàng ─────────────────────────────
echo -e "${YELLOW}[7/7] Chờ hệ thống sẵn sàng...${NC}"
echo -n "  Đang chờ backend"
MAX_WAIT=60
COUNT=0
while ! curl -s "http://localhost:4000/health" > /dev/null 2>&1; do
    echo -n "."
    sleep 2
    COUNT=$((COUNT + 2))
    if [ $COUNT -ge $MAX_WAIT ]; then
        echo ""
        echo -e "${RED}⚠️  Backend chưa phản hồi sau ${MAX_WAIT}s. Kiểm tra log:${NC}"
        echo "   docker compose logs backend"
        break
    fi
done

echo ""

# ─── Kết quả ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗"
echo -e "║          ✅  Cài đặt hoàn tất!           ║"
echo -e "╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 Dashboard:    ${CYAN}http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo -e "  🔧 Backend API:  ${CYAN}http://$(hostname -I | awk '{print $1}'):4000${NC}"
echo -e "  ❤️  Health Check: ${CYAN}http://$(hostname -I | awk '{print $1}'):4000/health${NC}"
echo ""
echo -e "${YELLOW}📋 Bước tiếp theo:${NC}"
echo "  1. Mở trình duyệt → http://$(hostname -I | awk '{print $1}'):3000"
echo "  2. Vào Settings → nhập API key Ship24 hoặc 17Track"
echo "  3. Cấu hình Telegram Bot nếu muốn nhận thông báo"
echo ""
echo -e "${YELLOW}⚠️  Quan trọng:${NC}"
echo "  - Đổi password PostgreSQL trong file $APP_DIR/.env"
echo "  - Nếu dùng server public, mở firewall port 3000 và 4000"
echo ""
echo -e "${CYAN}Quản lý services:${NC}"
echo "  Xem log:      docker compose logs -f"
echo "  Dừng:         docker compose stop"
echo "  Khởi động lại: docker compose restart"
echo "  Xóa tất cả:   docker compose down -v"
echo ""
