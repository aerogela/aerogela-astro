#!/usr/bin/env bash
# 用法: bash /workspace/.tools/restore-browser.sh
# 作用: 沙盒重置后一键恢复真实浏览器(chrome-devtools MCP 依赖 /opt/google/chrome/chrome)
#
# 持久化布局:
#   /workspace/.tools/browser/chrome-linux64/  ← Chrome for Testing 二进制(约 400MB,跨重置保留)
#   /workspace/.tools/browser/debs/            ← 系统库 .deb 离线备份(apt 失败时的兜底)
#
# 重置后系统库(/usr/lib)会丢,恢复顺序: 先试 apt(快),失败则用本地 .deb 解包。

set -u
CHROME_DIR="/workspace/.tools/browser/chrome-linux64"
DEB_DIR="/workspace/.tools/browser/debs"
PROXY="${HTTP_PROXY:-http://127.0.0.1:18080}"

# 1. 二进制必须在
if [ ! -x "$CHROME_DIR/chrome" ]; then
  echo "✗ Chrome 二进制缺失: $CHROME_DIR/chrome"
  echo "  重新下载(约 194MB,npmmirror 镜像):"
  echo "  mkdir -p /workspace/.tools/browser && cd /workspace/.tools/browser && \\"
  echo "  curl -sL -x $PROXY -o chrome.zip 'https://cdn.npmmirror.com/binaries/chrome-for-testing/152.0.7977.64/linux64/chrome-linux64.zip' && unzip -qo chrome.zip && rm chrome.zip"
  exit 1
fi

# 2. 检查系统库;缺则装
MISSING=$(ldd "$CHROME_DIR/chrome" 2>/dev/null | grep "not found" | head -1)
if [ -n "$MISSING" ]; then
  DEPS="libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libnss3 libnspr4 libatspi2.0-0 fonts-liberation"
  echo "→ 系统库缺失,尝试 apt 安装..."
  if apt-get -o Acquire::http::Proxy="$PROXY" -o Acquire::https::Proxy="$PROXY" install -y --no-install-recommends $DEPS >/dev/null 2>&1; then
    echo "✓ apt 安装完成"
  elif [ -d "$DEB_DIR" ] && ls "$DEB_DIR"/*.deb >/dev/null 2>&1; then
    echo "→ apt 失败,使用本地 .deb 离线解包..."
    mkdir -p /opt/browser-libs
    for d in "$DEB_DIR"/*.deb; do dpkg -x "$d" /opt/browser-libs; done
    # 离线库通过包装脚本注入 LD_LIBRARY_PATH
    cat > /workspace/.tools/browser/chrome-launch.sh <<'EOF'
#!/usr/bin/env bash
export LD_LIBRARY_PATH="/opt/browser-libs/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
exec /workspace/.tools/browser/chrome-linux64/chrome "$@"
EOF
    chmod +x /workspace/.tools/browser/chrome-launch.sh
    ln -sf /workspace/.tools/browser/chrome-launch.sh /opt/google/chrome/chrome 2>/dev/null
  fi
fi

# 3. 建立 MCP 期望的路径(chrome-devtools MCP 找 /opt/google/chrome/chrome)
#    指向包装器:root 环境需注入 --no-sandbox 等参数,否则浏览器秒退
mkdir -p /opt/google/chrome
ln -sf /workspace/.tools/browser/chrome-launch.sh /opt/google/chrome/chrome

# 4. 验证
if "$CHROME_DIR/chrome" --version >/dev/null 2>&1; then
  echo "✓ 浏览器就绪: $($CHROME_DIR/chrome --version 2>/dev/null)"
  echo "✓ MCP 路径: /opt/google/chrome/chrome -> $(readlink -f /opt/google/chrome/chrome)"
else
  echo "✗ 二进制仍无法运行,检查系统库"
  exit 1
fi
