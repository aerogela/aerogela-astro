#!/usr/bin/env bash
# 沙盒凭据恢复脚本 — 沙盒重置后运行一次即可恢复 GitHub SSH 推送能力
#
# 用法:
#   ./scripts/restore-credentials.sh <vault密码>
#   或:  VAULT_PASS=<密码> ./scripts/restore-credentials.sh
#
# 原理: 凭据以 AES-256 加密形式存放在 /workspace/.credentials/vault.enc
#       (/workspace 根目录在沙盒重置后保留,仓库内文件不存放任何密钥)
set -euo pipefail

PASS="${1:-${VAULT_PASS:-}}"
if [ -z "$PASS" ]; then
  echo "用法: $0 <vault密码>" >&2
  exit 1
fi

VAULT="${VAULT:-/workspace/.credentials/vault.enc}"
[ -f "$VAULT" ] || { echo "错误: $VAULT 不存在" >&2; exit 1; }

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

openssl enc -aes-256-cbc -d -pbkdf2 -iter 200000 \
  -in "$VAULT" -out "$TMP" -pass pass:"$PASS" 2>/dev/null \
  || { echo "错误: 解密失败(密码不对?)"; exit 1; }

# 提取 SSH 私钥(BEGIN OPENSSH PRIVATE KEY 到 END 行)
mkdir -p ~/.ssh && chmod 700 ~/.ssh
awk '/^-----BEGIN OPENSSH PRIVATE KEY-----$/{f=1} f{print} /^-----END OPENSSH PRIVATE KEY-----$/{exit}' \
  "$TMP" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
grep 'ssh-ed25519' "$TMP" | head -1 > ~/.ssh/id_ed25519.pub
chmod 644 ~/.ssh/id_ed25519.pub

# SSH 配置:沙盒需走 HTTP 代理连 GitHub(22 端口直连被封)
PROXY="${HTTP_PROXY:-http://127.0.0.1:18080}"
cat > ~/.ssh/config << EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 60
  ProxyCommand nc -X connect -x ${PROXY#http://} %h %p
EOF
chmod 600 ~/.ssh/config

# known_hosts
timeout 15 ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null || true

echo "✓ SSH 密钥已恢复: $(ssh-keygen -lf ~/.ssh/id_ed25519.pub)"
echo "✓ SSH 配置已写入(代理: $PROXY)"
echo ""
echo "验证: ssh -T git@github.com  (预期: Hi <用户名>!)"
