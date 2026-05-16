# VPS 反向代理 setup-vps.sh

把公网 VPS 配成 `https://你的域名` 的入口，背后转给 Tailscale 内网里的 Mac mini。

## 三件事先做完

### 1. DNS A 记录指到 VPS
```
A   erp        <VPS 公网 IP>     (TTL 600)
```
跑 `dig erp.你域名.com` 看是不是已经回 VPS IP，再继续。

### 2. 在 Tailscale 控制台生成 auth key
https://login.tailscale.com/admin/settings/keys → **Generate auth key**
- ☐ Reusable（这次脚本只用一次，建议关掉）
- ☑ Pre-authorized（必须，否则脚本上不去）
- Tags（可选）：建议加 `tag:vps`

复制出来形如 `tskey-auth-xxxxxxxxxxxxx`。

### 3. 拿到 Mac mini 的 Tailscale IP
Mac mini 上：
```bash
tailscale ip -4
# → 100.x.x.x
```

## 执行脚本

把脚本传上 VPS（用 scp / rsync 都行），然后：

```bash
sudo bash setup-vps.sh \
  --domain erp.example.com \
  --ts-authkey tskey-auth-xxxxxxxxxxxxxxx \
  --mini-ip 100.64.12.34
```

可选参数：
- `--upstream-port 4000` — Mac mini API 端口
- `--email you@you.com` — Let's Encrypt 联系邮箱
- `--no-tls` — 跳过证书（仅调试）

## 安全提醒

**auth key 会出现在 shell 历史和 ps**。两种规避：

```bash
# 方法 A：环境变量传入
TS_KEY='tskey-auth-...'
sudo bash setup-vps.sh --domain ... --ts-authkey "$TS_KEY" --mini-ip ...
# 跑完立刻：history -d $(history 1)；unset TS_KEY

# 方法 B：从文件读
echo 'tskey-auth-...' | sudo tee /root/.ts-key >/dev/null
sudo bash setup-vps.sh --domain ... --ts-authkey "$(cat /root/.ts-key)" --mini-ip ...
sudo shred -u /root/.ts-key
```

## 国内 VPS 的几个坑

1. **pkgs.tailscale.com 走 Cloudflare**，绝大多数国内云能直连；如果 apt 卡住：
   - 阿里云：常规可达，慢的话 30 秒会过
   - 腾讯云：少数节点偶发，重试 1-2 次基本能装
   - 实在不行：手动下 deb，`dpkg -i tailscale_*.deb`

2. **Let's Encrypt** 在国内能用，但 80 端口必须真的对外开放（验证用）。检查阿里云/腾讯云**安全组**有没有放 80 入站，仅 ufw 不够。

3. **Tailscale DERP 走境外**。如果 `tailscale netcheck` 显示走 Tokyo/SG DERP 而不是 Direct，国内同事经过 VPS 转发可能慢。让 VPS 和 Mac mini 都开 UDP 41641 出站，多数能打洞成功。

4. **关闭 systemd-resolved 占用 53 端口** 这个坑跟我们无关（脚本不动 DNS）。

## 跑完之后

脚本最后会打印验证命令。手动确认这两条：

```bash
# 1. VPS 自己健康
curl https://erp.你域名.com/_vps_health
# 应该返回 "vps-ok"

# 2. 全链路（要 Mac mini API 在跑）
curl -H 'Authorization: Bearer demo' https://erp.你域名.com/api/shops
# 应该返回 shop 数组
```

## 回滚

误装了或 nginx 配置坏了，回滚：

```bash
# 删 nginx 站点
sudo rm /etc/nginx/sites-enabled/erp.conf /etc/nginx/sites-available/erp.conf
sudo systemctl reload nginx

# 退出 tailnet（VPS 不需要 Tailscale 了的话）
sudo tailscale down
sudo systemctl disable --now tailscaled

# 卸载（极端情况）
sudo apt-get remove --purge tailscale nginx certbot
```

## 文件位置

| 位置 | 用途 |
|---|---|
| `/etc/nginx/sites-available/erp.conf` | 反代配置，可手动改 |
| `/etc/letsencrypt/live/<domain>/` | 证书，certbot 自动续期 |
| `/var/log/nginx/{access,error}.log` | 流量 + 错误 |
| `journalctl -u tailscaled -f` | Tailscale 日志 |
