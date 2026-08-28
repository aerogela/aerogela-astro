#!/usr/bin/env bash
# 沙盒凭据恢复 — 沙盒重置后运行一次即可恢复 GitHub SSH 推送能力
# 用法: ./restore-credentials.sh   (无需参数)
# 凭据明文存放在 /workspace/.credentials/(沙盒重置后保留的位置)
set -euo pipefail

CRED="${CRED_DIR:-/workspace/.credentials}"
[ -f "$CRED/id_ed25519" ] || { echo "错误: $CRED/id_ed25519 不存在" >&2; exit 1; }

# 安装 SSH 密钥
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cp "$CRED/id_ed25519" ~/.ssh/id_ed25519
cp "$CRED/id_ed25519.pub" ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/id_ed25519
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

# known_hosts:通过代理(而非直连 22 端口)自动获取 GitHub host key
timeout 20 ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>/dev/null || true

echo "✓ SSH 密钥已恢复: $(ssh-keygen -lf ~/.ssh/id_ed25519.pub)"
echo "✓ Cloudflare Token: $CRED/cloudflare-token.txt"
echo ""
echo "验证: ssh -T git@github.com"
