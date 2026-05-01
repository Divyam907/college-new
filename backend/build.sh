#!/usr/bin/env bash
set -o errexit

echo "=== Installing system dependencies ==="
apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0

echo "=== Upgrading pip ==="
pip install --upgrade pip

echo "=== Installing Python packages ==="
pip install -r requirements_render.txt

echo "=== Creating directories ==="
mkdir -p dataset images

echo "=== Build complete ==="
