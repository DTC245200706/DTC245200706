#!/usr/bin/env bash
set -euo pipefail
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj '/C=VN/ST=Thai Nguyen/L=Thai Nguyen/O=DTC245200706/OU=DevOps/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
chmod 600 nginx/certs/server.key
printf 'Generated nginx/certs/server.crt and server.key\n'
