# 公测部署手册

目标域名:`https://duoshouerp.868818.xyz`
目标 VPS:Ubuntu 22.04 建议 ≥ 2GB RAM / 20GB 磁盘

---

## 一次性准备

### 1. DNS 配置

在 `868818.xyz` 域名管理后台加一条 A 记录:

| Host         | Type | Value            | TTL |
|--------------|------|------------------|-----|
| duoshouerp   | A    | <VPS 公网 IP>    | 600 |

验证:

```bash
dig duoshouerp.868818.xyz +short
# 应返回 VPS IP
```

### 2. VPS 初始化

以 `ubuntu` 账号 SSH 进入 VPS:

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新 SSH 一次让 group 生效

# 开防火墙
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable

# 创建工作目录
sudo mkdir -p /opt/duoshou-erp
sudo chown $USER:$USER /opt/duoshou-erp

# clone repo(public repo 无需认证)
git clone https://github.com/sggtong1/duoshou-erp.git /opt/duoshou-erp
```

### 3. `.env.production`

在 VPS 上 `/opt/duoshou-erp/.env.production`(**不入 git**,手写):

```bash
cat > /opt/duoshou-erp/.env.production <<'ENV'
NODE_ENV=production
PORT=3000
DATABASE_URL=<粘贴开发用 .env.development 的同名 value>
SUPABASE_URL=<粘贴>
SUPABASE_ANON_KEY=<粘贴>
SUPABASE_SERVICE_ROLE_KEY=<粘贴>
CREDS_ENCRYPTION_KEY=<粘贴(或者新生成 32 字节 base64 串)>
REDIS_URL=redis://redis:6379
QUEUE_PREFIX=duoshou-prod
CORS_ORIGINS=https://duoshouerp.868818.xyz
ENV

chmod 600 /opt/duoshou-erp/.env.production
```

### 4. SSL 首次签发

DNS 必须先生效(`dig` 返回正确 IP),然后:

```bash
cd /opt/duoshou-erp/infra/docker
mkdir -p letsencrypt

# 第一次跑 certbot,用 standalone 模式占 80 端口
docker run -it --rm \
  -v /opt/duoshou-erp/infra/docker/letsencrypt:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d duoshouerp.868818.xyz \
  --agree-tos -m <your@email.com> --no-eff-email
```

成功后 `./letsencrypt/live/duoshouerp.868818.xyz/fullchain.pem` 和 `privkey.pem` 存在。

### 5. 续期 crontab

```bash
sudo crontab -e
# 加一行(每周一 03:00 跑):
0 3 * * 1 cd /opt/duoshou-erp/infra/docker && docker run --rm -v $PWD/letsencrypt:/etc/letsencrypt certbot/certbot renew --quiet && docker compose restart web
```

### 6. 首次启动

```bash
cd /opt/duoshou-erp/infra/docker
docker compose build api web    # 首次约 8-12 分钟
docker compose up -d
docker compose logs -f api      # 看 Nest 启动,Ctrl+C 退出
```

浏览器访问 `https://duoshouerp.868818.xyz`,应该能打开登录页。

---

## 日常更新流程

### A. 开发机推代码到 GitHub

```bash
# 在父 repo /Users/mx4com/coding 提交新 commit 到 duoshou-erp/ 路径后
cd /Users/mx4com/coding
bash duoshou-erp/infra/deploy/push-to-github.sh
```

### B. 触发 VPS 拉新代码 + 重建 + 重启

```bash
# 在开发机(需要 VPS 的 SSH 权限):
DEPLOY_HOST=<vps-host-or-ip> DEPLOY_USER=ubuntu \
  bash duoshou-erp/infra/deploy/deploy.sh
```

脚本会 ssh 上 VPS → git pull → docker compose build → up -d → 显示 api log 尾部。

### 回滚

```bash
ssh <vps> 'cd /opt/duoshou-erp && git reset --hard <old-sha> && cd infra/docker && docker compose build api web && docker compose up -d'
```

---

## 验收 checkpoint

部署完成后,按顺序验证:

- [ ] **A. DNS + SSL 就位**:浏览器打开 `https://duoshouerp.868818.xyz`,出现登录页,证书绿锁无警告
- [ ] **B. 完整 onboarding 流走通**:
  1. 用新邮箱注册(需要能收 Supabase 验证邮件)
  2. 登录 → 自动 redirect 到 `/shops/new`
  3. 填真实 Temu 测试凭据 → 点「测试连接」→ ✅ 绿
  4. 点「保存」→ 跳 `/shops` → 店铺列表里看到新店
  5. 点「货品模板」「核价单」「活动日历」等模块,都能打开
- [ ] **C. 邀请测试**:把 URL 发给 1 位朋友,他能独立完成 A + B 流程,试一次发品 / 核价 / 活动报名

---

## 常见问题

### Q: 证书报错 "unable to obtain certificate"
A: 检查 DNS 是否生效(`dig duoshouerp.868818.xyz` 返回 VPS IP),防火墙 80 是否开。

### Q: `docker compose build` 卡在 pnpm install
A: 首次构建会拉 Node 镜像 + 装依赖,10 分钟正常。网络差可以重试。

### Q: API 容器启动后立即退出
A: `docker compose logs api` 看错误。通常是 `.env.production` 里 `DATABASE_URL` 或 `REDIS_URL` 配错。`REDIS_URL` 必须是 `redis://redis:6379`(容器名不是 localhost)。

### Q: 部署后用户注册收不到验证邮件
A: Supabase 默认每 IP 每小时限 3 封邮件。邀请测试规模内一般够。若打到限,在 Supabase dashboard 配置自定义 SMTP(如 Resend / SendGrid)。

### Q: 硬盘满了
A: `docker system prune -af` 清 build cache。每周 1 次是安全的。

### Q: 证书 60 天后还没自动续期
A: 手动跑:

```bash
cd /opt/duoshou-erp/infra/docker
docker run --rm -v $PWD/letsencrypt:/etc/letsencrypt certbot/certbot renew
docker compose restart web
```
