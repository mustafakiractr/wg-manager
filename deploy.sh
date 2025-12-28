#!/bin/bash

#############################################
# Production Deployment Script
# Uygulamayı production ortamına deploy eder
#############################################

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║  Production Deployment                     ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Bu script root yetkisi ile çalıştırılmalıdır${NC}"
    echo -e "${YELLOW}Devam etmek için: sudo bash deploy.sh${NC}"
    exit 1
fi

INSTALL_DIR=$(pwd)
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIR="$INSTALL_DIR/frontend"

#############################################
# 1. Güvenlik Kontrolleri
#############################################

echo -e "${YELLOW}🔒 Güvenlik kontrolleri yapılıyor...${NC}"

# .env dosyası kontrolü
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${RED}❌ .env dosyası bulunamadı!${NC}"
    echo -e "${YELLOW}Önce: bash setup_environment.sh${NC}"
    exit 1
fi

# SECRET_KEY kontrolü
if grep -q "CHANGE_THIS_TO_A_RANDOM_SECRET_KEY" "$BACKEND_DIR/.env"; then
    echo -e "${RED}❌ SECRET_KEY default değerde!${NC}"
    echo -e "${YELLOW}Önce: bash setup_environment.sh${NC}"
    exit 1
fi

# ENVIRONMENT kontrolü
if ! grep -q 'ENVIRONMENT="production"' "$BACKEND_DIR/.env"; then
    echo -e "${RED}❌ ENVIRONMENT production değil!${NC}"
    read -p "$(echo -e ${YELLOW}Devam etmek istiyor musunuz? (y/N): ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Güvenlik kontrolleri geçti${NC}"
echo ""

#############################################
# 2. Dependency Güncellemeleri
#############################################

echo -e "${BLUE}📦 Dependencies güncelleniyor...${NC}"

# Backend dependencies
cd "$BACKEND_DIR"
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
deactivate
echo -e "${GREEN}✅ Backend dependencies güncellendi${NC}"

# Frontend dependencies
cd "$FRONTEND_DIR"
npm install --silent
echo -e "${GREEN}✅ Frontend dependencies güncellendi${NC}"

cd "$INSTALL_DIR"
echo ""

#############################################
# 3. Frontend Build
#############################################

echo -e "${BLUE}🏗️  Frontend build yapılıyor...${NC}"

cd "$FRONTEND_DIR"

# Eski build'i temizle
if [ -d "dist" ]; then
    rm -rf dist
    echo -e "${YELLOW}Eski build temizlendi${NC}"
fi

# Production build
npm run build

if [ -d "dist" ]; then
    echo -e "${GREEN}✅ Frontend build tamamlandı${NC}"
    echo -e "${BLUE}   Build boyutu: $(du -sh dist | cut -f1)${NC}"
else
    echo -e "${RED}❌ Build başarısız!${NC}"
    exit 1
fi

cd "$INSTALL_DIR"
echo ""

#############################################
# 4. Database Backup
#############################################

echo -e "${BLUE}💾 Database backup alınıyor...${NC}"

BACKUP_DIR="$INSTALL_DIR/backups"
mkdir -p "$BACKUP_DIR"

if [ -f "$BACKEND_DIR/router_manager.db" ]; then
    BACKUP_FILE="$BACKUP_DIR/router_manager_$(date +%Y%m%d_%H%M%S).db"
    cp "$BACKEND_DIR/router_manager.db" "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backup oluşturuldu: $BACKUP_FILE${NC}"

    # Eski backupları temizle (30 günden eski)
    find "$BACKUP_DIR" -name "router_manager_*.db" -mtime +30 -delete 2>/dev/null
    echo -e "${BLUE}   Toplam backup sayısı: $(ls -1 $BACKUP_DIR/*.db 2>/dev/null | wc -l)${NC}"
else
    echo -e "${YELLOW}⚠️  Database dosyası bulunamadı (ilk deploy olabilir)${NC}"
fi

echo ""

#############################################
# 5. Systemd Services
#############################################

echo -e "${BLUE}🔧 Systemd servisleri yapılandırılıyor...${NC}"

# Backend service
cat > /etc/systemd/system/wg-backend.service << EOF
[Unit]
Description=MikroTik WireGuard Manager Backend
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin"
ExecStart=$BACKEND_DIR/venv/bin/python $BACKEND_DIR/run.py
Restart=always
RestartSec=10
StandardOutput=append:$BACKEND_DIR/logs/backend.log
StandardError=append:$BACKEND_DIR/logs/backend_error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (production'da genellikle Nginx ile serve edilir)
cat > /etc/systemd/system/wg-frontend.service << EOF
[Unit]
Description=MikroTik WireGuard Manager Frontend (Dev Server)
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10
StandardOutput=append:$INSTALL_DIR/frontend.log
StandardError=append:$INSTALL_DIR/frontend_error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
echo -e "${GREEN}✅ Systemd servisleri oluşturuldu${NC}"
echo ""

#############################################
# 6. Servisleri Yeniden Başlat
#############################################

echo -e "${BLUE}🔄 Servisler yeniden başlatılıyor...${NC}"

# Eski servisleri durdur
pkill -f 'python.*run.py' 2>/dev/null || true
pkill -f 'vite' 2>/dev/null || true
sleep 2

# Systemd ile başlat
systemctl restart wg-backend
systemctl restart wg-frontend

# Otomatik başlatmayı etkinleştir
systemctl enable wg-backend
systemctl enable wg-frontend

sleep 3

# Durum kontrolü
if systemctl is-active --quiet wg-backend; then
    echo -e "${GREEN}✅ Backend servisi çalışıyor${NC}"
else
    echo -e "${RED}❌ Backend servisi başlatılamadı${NC}"
    systemctl status wg-backend --no-pager -l
    exit 1
fi

if systemctl is-active --quiet wg-frontend; then
    echo -e "${GREEN}✅ Frontend servisi çalışıyor${NC}"
else
    echo -e "${RED}❌ Frontend servisi başlatılamadı${NC}"
    systemctl status wg-frontend --no-pager -l
    exit 1
fi

echo ""

#############################################
# 7. Nginx Yapılandırması (Opsiyonel)
#############################################

if command -v nginx &> /dev/null; then
    read -p "$(echo -e ${YELLOW}Nginx reverse proxy yapılandırması oluşturulsun mu? (y/N): ${NC})" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Domain adınız (örn: wg.yourdomain.com): " DOMAIN

        cat > /etc/nginx/sites-available/wg-manager << EOF
# MikroTik WireGuard Manager
# Frontend + Backend Reverse Proxy

upstream backend {
    server 127.0.0.1:8001;
}

server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (production build)
    location / {
        root $FRONTEND_DIR/dist;
        try_files \$uri \$uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # API Docs
    location /docs {
        proxy_pass http://backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }
}
EOF

        # Symlink oluştur
        ln -sf /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/

        # Nginx config test
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            echo -e "${GREEN}✅ Nginx yapılandırması oluşturuldu ve yüklendi${NC}"
            echo -e "${YELLOW}💡 SSL için: certbot --nginx -d $DOMAIN${NC}"
        else
            echo -e "${RED}❌ Nginx config hatası!${NC}"
            nginx -t
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Nginx bulunamadı (production için önerilir)${NC}"
    echo -e "${YELLOW}   Yüklemek için: apt-get install nginx${NC}"
fi

echo ""

#############################################
# 8. Firewall Yapılandırması
#############################################

echo -e "${BLUE}🔥 Firewall kontrolleri...${NC}"

if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}UFW portları açılıyor...${NC}"

    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw allow 8001/tcp comment 'WG Backend API'
    ufw allow 5173/tcp comment 'WG Frontend Dev'

    echo -e "${GREEN}✅ Firewall kuralları eklendi${NC}"
else
    echo -e "${YELLOW}⚠️  UFW bulunamadı${NC}"
fi

echo ""

#############################################
# 9. Deployment Özeti
#############################################

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════╗"
echo "║    ✅ DEPLOYMENT TAMAMLANDI! ✅           ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Servis Durumu:${NC}"
systemctl status wg-backend --no-pager -l | head -3
systemctl status wg-frontend --no-pager -l | head -3
echo ""

echo -e "${BLUE}🌐 Erişim Bilgileri:${NC}"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "  Lokal IP:    http://$SERVER_IP:5173"
echo "  Backend API: http://$SERVER_IP:8001"
echo "  API Docs:    http://$SERVER_IP:8001/docs"
echo ""

echo -e "${BLUE}📝 Servis Yönetimi:${NC}"
echo "  Durum:        systemctl status wg-backend wg-frontend"
echo "  Durdur:       systemctl stop wg-backend wg-frontend"
echo "  Başlat:       systemctl start wg-backend wg-frontend"
echo "  Yeniden:      systemctl restart wg-backend wg-frontend"
echo "  Loglar:       journalctl -u wg-backend -f"
echo ""

echo -e "${BLUE}💾 Backup:${NC}"
echo "  Son backup: $(ls -t $BACKUP_DIR/*.db 2>/dev/null | head -1)"
echo "  Toplam:     $(ls -1 $BACKUP_DIR/*.db 2>/dev/null | wc -l) backup"
echo ""

echo -e "${YELLOW}⚠️  Önemli Notlar:${NC}"
echo "  • SSL/TLS sertifikası için: certbot --nginx"
echo "  • Database backup'ları otomatik (30 gün)
echo "  • Log dosyaları: backend/logs/ ve journalctl"
echo "  • SECURITY.md dosyasındaki kontrol listesini uygulayın"
echo ""

echo -e "${GREEN}✅ Production deployment başarılı!${NC}"
