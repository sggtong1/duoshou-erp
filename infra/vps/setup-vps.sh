#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
# VPS 反向代理 + Tailscale 一键配置
# 目标：暴露 https://<your-domain> → Tailscale → Mac mini :4000
#
# 适用：Debian 11/12 · Ubuntu 20.04/22.04/24.04
# 测试过：阿里云 ECS · 腾讯云 CVM · 华为云 ECS · 国外 KVM
#
# 用法：
#   curl -fsSL <脚本地址> -o setup-vps.sh
#   sudo bash setup-vps.sh \
#        --domain erp.example.com \
#        --ts-authkey tskey-auth-xxxxxxxxxxxxxxxx \
#        --mini-ip 100.64.12.34
#
# 必填参数：
#   --domain        已经把 A 记录解析到本机的域名
#   --ts-authkey    Tailscale 预生成 auth key（admin.tailscale.com → Settings → Keys）
#   --mini-ip       Mac mini 的 Tailscale IP（100.x.x.x），在 Mac mini 上 `tailscale ip -4` 看到
#
# 可选参数：
#   --upstream-port  Mac mini API 端口，默认 4000
#   --email          certbot 联系邮箱，默认 admin@<domain>
#   --no-tls         跳过 certbot（仅 HTTP，调试用，不建议生产）
# ────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── 颜色 + 日志辅助 ──────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'; BLU='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLU}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GRN}✓${NC} $*"; }
warn() { echo -e "${YLW}!${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

# ── 必须 root ────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "请用 sudo 或 root 运行"

# ── 解析参数 ─────────────────────────────────────────────────────────
DOMAIN=""; TS_AUTHKEY=""; MINI_IP=""
UPSTREAM_PORT=4000; EMAIL=""; SKIP_TLS=0
HTTP_PORT=80      # 监听端口；80 被云厂商封时可改 8080

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)        DOMAIN=$2; shift 2 ;;
    --ts-authkey)    TS_AUTHKEY=$2; shift 2 ;;
    --mini-ip)       MINI_IP=$2; shift 2 ;;
    --upstream-port) UPSTREAM_PORT=$2; shift 2 ;;
    --email)         EMAIL=$2; shift 2 ;;
    --no-tls)        SKIP_TLS=1; shift ;;
    --http-port)     HTTP_PORT=$2; shift 2 ;;
    -h|--help)       sed -n '2,/^set -e/p' "$0" | head -n 30; exit 0 ;;
    *)               die "未知参数: $1" ;;
  esac
done

# 非标 HTTP 端口 → 自动跳过 TLS（Let's Encrypt 必须 80）
if [[ "$HTTP_PORT" != "80" ]]; then
  if [[ $SKIP_TLS -eq 0 ]]; then
    warn "HTTP 端口非 80，自动启用 --no-tls（Let's Encrypt http-01 验证强制走 80）"
    SKIP_TLS=1
  fi
fi

[[ -n "$DOMAIN"     ]] || die "缺 --domain"
[[ -n "$TS_AUTHKEY" ]] || die "缺 --ts-authkey"
[[ -n "$MINI_IP"    ]] || die "缺 --mini-ip"
# 必须是 4 段纯数字、100.xxx.xxx.xxx
if ! [[ "$MINI_IP" =~ ^100\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  die "--mini-ip 不是合法的 Tailscale IP（应为 100.xxx.xxx.xxx）。在 Mac mini 上跑 'tailscale ip -4' 拿到真实地址，别用占位符 100.x.x.x"
fi
[[ -z "$EMAIL"      ]] && EMAIL="admin@${DOMAIN}"

# ── 检测发行版 ───────────────────────────────────────────────────────
[[ -f /etc/os-release ]] || die "无法识别系统（缺 /etc/os-release）"
. /etc/os-release
case "$ID" in
  debian|ubuntu) ok "系统：$PRETTY_NAME" ;;
  *) die "暂只支持 Debian/Ubuntu，当前：$ID" ;;
esac
CODENAME=$VERSION_CODENAME

# ── 1. apt 索引：先试现有，失败则自动换镜像 ─────────────────────
auto_fix_apt() {
  # 已经能用就直接走
  if apt-get update -qq 2>/dev/null; then return 0; fi

  warn "apt 源不可用（可能 sources.list 指向 EOL 发行版或镜像挂了），自动修复..."

  cp /etc/apt/sources.list "/etc/apt/sources.list.bak.$(date +%s)" 2>/dev/null || true

  # 把 sources.list.d/ 里指向旧 codename 的列表禁用掉（避免冲突）
  for f in /etc/apt/sources.list.d/*.list; do
    [[ -f "$f" ]] || continue
    [[ "$f" == *tailscale* ]] && continue
    if grep -qE '\b(buster|stretch|jessie|bionic|focal)\b' "$f" 2>/dev/null \
       && ! grep -qE "\b${CODENAME}\b" "$f" 2>/dev/null; then
      mv "$f" "${f}.disabled.$(date +%s)"
      log "  禁用过期源: $f"
    fi
  done

  # buster 已 EOL，走 archive.debian.org
  if [[ "$ID" == "debian" && "$CODENAME" == "buster" ]]; then
    warn "Debian 10 (buster) 已 EOL —— 使用 archive.debian.org（强烈建议升级到 11/12）"
    cat > /etc/apt/sources.list <<EOF
deb http://archive.debian.org/debian buster main contrib non-free
deb http://archive.debian.org/debian-security buster/updates main contrib non-free
EOF
    echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99-no-check-valid
    apt-get update -qq && return 0 || die "EOL buster 源不可用，必须升级系统"
  fi

  # 候选镜像（按"国内 VPS 优先 + 通用兜底"排）
  local distro="debian";  local sec_path="debian-security"
  [[ "$ID" == "ubuntu" ]] && { distro="ubuntu"; sec_path="ubuntu"; }

  local mirrors=(
    "mirrors.aliyun.com"
    "mirrors.tencent.com"
    "mirrors.huaweicloud.com"
    "mirrors.ustc.edu.cn"
    "mirrors.tuna.tsinghua.edu.cn"
    "deb.debian.org"
  )

  local components="main contrib non-free"
  [[ "$ID" == "debian" && "$CODENAME" == "bookworm" ]] && components="$components non-free-firmware"
  [[ "$ID" == "ubuntu" ]] && components="main restricted universe multiverse"

  local picked=""
  for m in "${mirrors[@]}"; do
    log "  尝试镜像: $m ..."
    if [[ "$ID" == "debian" ]]; then
      cat > /etc/apt/sources.list <<EOF
deb https://${m}/${distro}/ ${CODENAME} ${components}
deb https://${m}/${distro}/ ${CODENAME}-updates ${components}
deb https://${m}/${distro}/ ${CODENAME}-backports ${components}
deb https://${m}/${sec_path}/ ${CODENAME}-security ${components}
EOF
    else
      cat > /etc/apt/sources.list <<EOF
deb https://${m}/${distro}/ ${CODENAME} ${components}
deb https://${m}/${distro}/ ${CODENAME}-updates ${components}
deb https://${m}/${distro}/ ${CODENAME}-backports ${components}
deb https://${m}/${distro}/ ${CODENAME}-security ${components}
EOF
    fi
    if apt-get update -qq 2>/dev/null; then
      picked="$m"
      break
    fi
  done

  [[ -z "$picked" ]] && die "所有镜像都失败 — 检查 VPS 出网/DNS"
  ok "apt 镜像选定: $picked (${ID}/${CODENAME})"
}

log "准备 apt 索引（codename=$CODENAME）..."
export DEBIAN_FRONTEND=noninteractive
auto_fix_apt
apt-get install -y -qq curl gnupg ca-certificates ufw lsb-release >/dev/null
ok "基础工具就绪"

# ── 网络预检（在 curl 装完之后才做）────────────────────────────────
log "网络预检..."
if ! curl -fsS --connect-timeout 8 https://pkgs.tailscale.com >/dev/null 2>&1; then
  warn "pkgs.tailscale.com 慢/不通 — 国内 VPS 偶发，下一步如卡住请重试一两次"
else
  ok "外网可达"
fi

# ── 2. 安装 Tailscale ───────────────────────────────────────────────
if ! command -v tailscale >/dev/null 2>&1; then
  log "安装 Tailscale..."
  curl -fsSL "https://pkgs.tailscale.com/stable/${ID}/${CODENAME}.noarmor.gpg" \
    | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
  curl -fsSL "https://pkgs.tailscale.com/stable/${ID}/${CODENAME}.tailscale-keyring.list" \
    | tee /etc/apt/sources.list.d/tailscale.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq tailscale >/dev/null
  ok "Tailscale 安装完成"
else
  ok "Tailscale 已存在，跳过安装"
fi

# 启动 tailscaled 并加入 tailnet
systemctl enable --now tailscaled
if ! tailscale status >/dev/null 2>&1; then
  log "加入 tailnet（使用 auth key）..."
  tailscale up --authkey="$TS_AUTHKEY" --ssh --hostname="vps-erp-$(hostname -s)"
  ok "已加入 tailnet"
else
  ok "tailnet 已在线"
fi

VPS_TS_IP=$(tailscale ip -4 | head -n1)
log "VPS Tailscale IP: $VPS_TS_IP"

# 测试到 Mac mini 的 Tailscale 连通
log "测试到 Mac mini ($MINI_IP) 的 Tailscale 通路..."
if timeout 8 tailscale ping -c 3 "$MINI_IP" >/dev/null 2>&1; then
  ok "Tailscale 到 Mac mini 直通"
else
  warn "Tailscale ping 失败 —— Mac mini 可能未在线，或对方 tailnet 未授权本机。继续部署。"
fi

# ── 3. 安装 nginx ───────────────────────────────────────────────────
if ! command -v nginx >/dev/null 2>&1; then
  log "安装 nginx..."
  apt-get install -y -qq nginx >/dev/null
  ok "nginx 安装完成"
else
  ok "nginx 已存在"
fi

# ── 4. 写 nginx 站点配置 ────────────────────────────────────────────
SITE_FILE=/etc/nginx/sites-available/erp.conf
log "生成 nginx 站点 → $SITE_FILE"
cat > "$SITE_FILE" <<EOF
# Auto-generated by setup-vps.sh
# certbot 装完证书后会自动追加 301 跳转块
server {
  listen ${HTTP_PORT};
  listen [::]:${HTTP_PORT};
  server_name ${DOMAIN};

  # certbot http-01 验证用（只有 HTTP_PORT=80 时 certbot 才会真的来访）
  location /.well-known/acme-challenge/ { root /var/www/html; }

  location / {
    proxy_pass http://${MINI_IP}:${UPSTREAM_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    # 长轮询 / SSE 友好
    proxy_read_timeout  5m;
    proxy_send_timeout  5m;

    # WebSocket 兼容
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # 健康检查路径，不打到 Mac mini，给监控用
  location = /_vps_health {
    access_log off;
    add_header Content-Type text/plain;
    return 200 "vps-ok\n";
  }
}
EOF

ln -sf "$SITE_FILE" /etc/nginx/sites-enabled/erp.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null
systemctl reload nginx
ok "nginx 配置就绪，HTTP 已 serve"

# ── 5. 防火墙（增量加规则，绝不 reset，避免把自己 SSH 锁外面）─────
log "配置 UFW 防火墙..."
# 自动识别当前 SSH 端口
SSH_PORT=$(awk '/^[[:space:]]*Port[[:space:]]+[0-9]+/ {p=$2} END{print (p?p:22)}' /etc/ssh/sshd_config)
log "  检测到 SSH 端口: $SSH_PORT"

# 如果 UFW 没开过，给它一个安全的默认策略；如果已经在用就保留现状
if ! ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw default deny incoming  >/dev/null
  ufw default allow outgoing >/dev/null
fi
ufw allow "${SSH_PORT}/tcp"  comment 'SSH'                  >/dev/null
ufw allow "${HTTP_PORT}/tcp" comment 'HTTP / ACME'           >/dev/null
[[ $SKIP_TLS -eq 0 ]] && ufw allow 443/tcp comment 'HTTPS'   >/dev/null
ufw allow 41641/udp          comment 'Tailscale WireGuard'   >/dev/null
ufw --force enable           >/dev/null
TLS_PORT_NOTE=""
[[ $SKIP_TLS -eq 0 ]] && TLS_PORT_NOTE=" · 443/tcp"
ok "防火墙：${SSH_PORT}/tcp · ${HTTP_PORT}/tcp${TLS_PORT_NOTE} · 41641/udp 已开"

# ── 6. certbot HTTPS 证书 ───────────────────────────────────────────
if [[ $SKIP_TLS -eq 0 ]]; then
  log "签发 Let's Encrypt 证书..."
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  certbot --nginx \
    --domain "$DOMAIN" \
    --non-interactive --agree-tos --email "$EMAIL" \
    --redirect --no-eff-email \
    || die "certbot 失败 — 检查 DNS A 记录是否指到本机 IP，以及 80 端口是否对外可达"
  ok "HTTPS 证书签发完成，已开启 80→443 跳转"

  # 续期 cron（apt 装包默认带，但确认一下）
  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
else
  warn "已跳过 TLS。生产前务必加证书。"
fi

# ── 7. 健康检查 ─────────────────────────────────────────────────────
log "运行健康检查..."

# 7a. Tailscale 状态
TS_STATE=$(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | head -1 || true)
[[ "$TS_STATE" == *Running* ]] && ok "Tailscale: Running" || warn "Tailscale state: $TS_STATE"

# 7b. nginx 状态
systemctl is-active --quiet nginx && ok "nginx: active" || die "nginx 没起来"

# 7c. 本地 → Tailscale → Mac mini 全链路
SCHEME="http"
PORT_SUFFIX=""
if [[ $SKIP_TLS -eq 0 ]]; then
  SCHEME="https"
else
  # HTTP 模式：非 80 端口要带在 URL 里
  [[ "$HTTP_PORT" != "80" ]] && PORT_SUFFIX=":${HTTP_PORT}"
fi
BASE_URL="${SCHEME}://${DOMAIN}${PORT_SUFFIX}"

log "测试 ${BASE_URL}/_vps_health ..."
if curl -fsS --max-time 10 "${BASE_URL}/_vps_health" >/dev/null; then
  ok "VPS 自身响应 OK"
else
  warn "VPS 自身 _vps_health 不通 —— 大概率是："
  warn "  1) DNS 还在生效（dig $DOMAIN 看是否回 VPS 公网 IP）"
  warn "  2) 云厂商安全组没放 ${HTTP_PORT} 端口（控制台 → 实例 → 安全组）"
  warn "  3) 国内 VPS + 域名未备案 → 80/443 被网关层拦（换 --http-port 8080 试）"
fi

log "测试 Mac mini 上游 (${MINI_IP}:${UPSTREAM_PORT})..."
if curl -fsS --max-time 10 "${BASE_URL}/api/health" >/dev/null 2>&1 \
   || curl -fsS --max-time 10 "http://${MINI_IP}:${UPSTREAM_PORT}/api/health" >/dev/null 2>&1; then
  ok "Mac mini API 链路 OK"
else
  warn "Mac mini /api/health 没回 —— 检查："
  warn "  1) Mac mini 上 API 是否在 4000 跑：lsof -i :4000"
  warn "  2) Mac mini 防火墙是否放过 Tailscale 来源"
  warn "  3) tailscale ping $MINI_IP 看 P2P 是否直通"
fi

# ── 8. 总结 ─────────────────────────────────────────────────────────
cat <<EOF

────────────────────────────────────────────────
${GRN}部署完成${NC}

入口地址      : ${BASE_URL}
VPS Tailscale : $VPS_TS_IP
Mac mini      : ${MINI_IP}:${UPSTREAM_PORT}
nginx site    : $SITE_FILE
TLS 模式      : $( [[ $SKIP_TLS -eq 0 ]] && echo "HTTPS (Let's Encrypt 已签发)" || echo "HTTP（已跳过证书）" )

测试：
  curl ${BASE_URL}/_vps_health
  curl -H 'Authorization: Bearer demo' ${BASE_URL}/api/shops

下一步：
  1. Mac mini 上 .env 把 CORS_ORIGIN 加上 ${BASE_URL}
  2. 同事浏览器装插件 → 配置 → ERP API 地址：${BASE_URL}
  3. 跑 \`tailscale ping ${MINI_IP}\` 看是否 via DIRECT（不是 via DERP-tok）
────────────────────────────────────────────────
EOF
