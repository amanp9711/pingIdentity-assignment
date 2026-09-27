#!/bin/bash
set -e

echo "Installing dependencies..."
npm run install:all

echo ""
echo "Starting services..."
echo "  API:       http://localhost:3001"
echo "  Dashboard: http://localhost:5173"
echo ""

npm run dev
