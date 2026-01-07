#!/bin/bash

# ============================================
# KURULUM TESTI - Docker Container
# ============================================

set -e

echo "===================================================================="
echo "       FRESH INSTALL TEST - DOCKER CONTAINER                       "
echo "===================================================================="
echo ""

# Docker kurulu mu kontrol et
if ! command -v docker &> /dev/null; then
    echo "Docker kurulu degil. Kuruluyor..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo systemctl start docker
    sudo systemctl enable docker
    echo "OK - Docker kuruldu"
fi

echo "Docker test container'i olusturuluyor..."
echo ""

# Test için Dockerfile oluştur
cat > Dockerfile.test << 'DOCKERFILE'
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Istanbul

# Temel araçları kur
RUN apt-get update && apt-get install -y \
    git curl sudo python3 python3-pip python3-venv \
    nodejs npm netstat-nat && \
    rm -rf /var/lib/apt/lists/*

# Node.js 20+ kur
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Test kullanıcısı oluştur
RUN useradd -m -s /bin/bash testuser && \
    echo "testuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER testuser
WORKDIR /home/testuser

# Proje dosyalarını kopyala
COPY --chown=testuser:testuser . /home/testuser/wg-manager

WORKDIR /home/testuser/wg-manager

CMD ["/bin/bash"]
DOCKERFILE

echo "Docker image olusturuluyor..."
docker build -f Dockerfile.test -t wg-manager-test . 2>&1 | tail -n 20

echo ""
echo "OK - Test container hazir!"
echo ""
echo "===================================================================="
echo "                    TEST KOMUTLARI                                  "
echo "===================================================================="
echo ""
echo "1. Container'i baslat:"
echo "   docker run -it --rm --name wg-test wg-manager-test"
echo ""
echo "2. Container icinde test et:"
echo "   cd /home/testuser/wg-manager"
echo "   sudo bash quick-start.sh"
echo ""
echo "3. Manuel adim adim test:"
echo "   sudo bash install.sh"
echo "   bash setup_environment.sh"
echo "   bash start_all.sh"
echo ""
echo "4. Loglari kontrol et:"
echo "   tail -f backend/logs/backend.log"
echo ""
echo "5. Test bitince temizle:"
echo "   docker rmi wg-manager-test"
echo "   rm Dockerfile.test"
echo ""
echo "--------------------------------------------------------------------"
echo ""
echo "ONERI: Interactive modda test edin:"
echo ""
echo "docker run -it --rm -p 8001:8001 -p 5173:5173 \\"
echo "  --name wg-test wg-manager-test bash"
echo ""
echo "Bu sekilde portlari expose edebilir ve web arayuzunu"
echo "host'tan http://localhost:5173 ile test edebilirsiniz."
echo ""
echo "===================================================================="
echo ""
