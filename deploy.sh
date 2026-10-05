#!/bin/bash
set -e

echo "=== Deploy Marineport ==="

echo "[1/4] Git pull..."
git stash
git pull origin dev
git stash drop 2>/dev/null || true

echo "[2/4] Install & build frontend..."
cd frontend
npm install
npm run build
cd ..

echo "[3/4] Install backend dependencies..."
cd backend
npm install
cd ..

echo "[4/4] Restart PM2..."
pm2 restart sis-fe
pm2 restart sis-be

echo "=== Deploy xong ==="
