# TASK-13: Deploy VPS

## Why
Đưa hệ thống lên production — VPS Linux với Nginx + PM2 + MySQL.

## Trạng thái: PENDING (làm cuối cùng)

## Yêu cầu server
- Ubuntu 22.04 LTS
- RAM: 2GB+ (4GB recommended)
- Node.js 20 LTS
- MySQL 8.0
- Nginx
- PM2

## How — Các bước thực hiện

### Bước 1: Chuẩn bị server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2
```

### Bước 2: Setup MySQL

```sql
CREATE DATABASE marineport CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'marineport'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON marineport.* TO 'marineport'@'localhost';
FLUSH PRIVILEGES;
```

Chạy migration:
```bash
mysql -u marineport -p marineport < migration.sql
```

### Bước 3: Deploy backend

```bash
# Clone repo
git clone <repo_url> /var/www/marineport
cd /var/www/marineport/backend

# Tạo .env production
cp .env.example .env.production
# Sửa: DB_HOST, DB_USER, DB_PASS, DB_NAME, JWT_SECRET, NODE_ENV=production

# Install dependencies
npm install --production

# Start với PM2
pm2 start server.js --name marineport-api --env production
pm2 save
pm2 startup
```

### Bước 4: Build và deploy frontend

```bash
cd /var/www/marineport/frontend

# Tạo .env.production
echo "VITE_API_URL=https://yourdomain.com/api/v1" > .env.production

# Build
npm install
npm run build

# Output: dist/ folder
```

### Bước 5: Cấu hình Nginx

**File**: `/etc/nginx/sites-available/marineport`

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (React SPA)
    location / {
        root /var/www/marineport/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # File uploads
    location /uploads/ {
        alias /var/www/marineport/backend/uploads/;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/marineport /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Bước 6: SSL với Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
# Auto-renew đã được setup bởi certbot
```

### Bước 7: Script deploy

**File**: `deploy.sh` (ở root repo)

```bash
#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Installing backend dependencies..."
cd backend && npm install --production && cd ..

echo "Building frontend..."
cd frontend && npm install && npm run build && cd ..

echo "Restarting API server..."
pm2 restart marineport-api

echo "Deploy complete!"
```

## Files cần tạo
- `backend/.env.example` — template env vars
- `deploy.sh` — deploy script
- `ecosystem.config.js` — PM2 config

## PM2 ecosystem config

**File**: `backend/ecosystem.config.js`

```js
module.exports = {
  apps: [{
    name: 'marineport-api',
    script: 'server.js',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

## Điểm quan trọng
- JWT_SECRET phải random, mạnh (32+ chars)
- Không commit `.env` production lên git
- Upload folder cần backup định kỳ
- MySQL backup: `mysqldump` cron job hàng ngày
- Firewall: chỉ mở port 80, 443, 22

## Acceptance Criteria
- [ ] Backend chạy ổn định với PM2
- [ ] Frontend build và serve được qua Nginx
- [ ] API accessible qua `https://yourdomain.com/api/v1`
- [ ] SSL certificate hoạt động
- [ ] PM2 tự restart khi server reboot
- [ ] Deploy script chạy được
