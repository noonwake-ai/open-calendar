# 树莓派初始化与排障

这份文档记录树莓派部署的完整背景，用于首次初始化、配置恢复、回滚和排障。

适用范围：

- 本地项目：`/Users/wyh/G/company/open-calendar`
- 树莓派地址：`192.168.48.253`
- 树莓派用户：`noonwake`
- 树莓派部署目录：`/home/noonwake/app/dist-pi/`
- 访问地址：`http://127.0.0.1:8082/pi/`

## 当前稳定契约

当前方案固定如下：

- 前端构建产物目录为 `dist-pi`
- Vite `base` 为 `/pi/`
- nginx 从 `/home/noonwake/app/dist-pi/` 提供 `/pi/`
- nginx 将 `/printer/` 反代到 `http://127.0.0.1:8787/`
- 图形会话启动后，由 `labwc` 的 autostart 启动 Chromium 全屏打开 `http://127.0.0.1:8082/pi/`

关键文件：

- [vite.config.ts](/Users/wyh/G/company/open-calendar/vite.config.ts)
- [.gitignore](/Users/wyh/G/company/open-calendar/.gitignore)
- [src/utils/printer.ts](/Users/wyh/G/company/open-calendar/src/utils/printer.ts)
- [src/utils/public-asset-url.ts](/Users/wyh/G/company/open-calendar/src/utils/public-asset-url.ts)
- `/home/noonwake/.config/labwc/autostart`
- `/home/noonwake/.local/bin/pi-kiosk-launch.sh`
- `/home/noonwake/.config/pi-kiosk.env`
- `/etc/nginx/sites-available/pi-app`

## 代码侧要求

部署前不要改回旧路径约定：

- 构建输出目录必须是 `dist-pi`
- 路由和静态资源路径必须基于 `/pi/`
- 打印请求必须走同源 `/printer`
- `dist-pi/` 只做构建产物，不提交 Git

## 开机自启动链路

当前只保留这一条链路：

1. 树莓派自动进入桌面会话
2. `labwc` 启动时执行 `~/.config/labwc/autostart`
3. `autostart` 调用 `~/.local/bin/pi-kiosk-launch.sh`
4. 启动脚本读取 `~/.config/pi-kiosk.env`
5. Chromium 使用独立 profile 全屏打开 `http://127.0.0.1:8082/pi/`

关键参数：

```bash
KIOSK_URL="http://127.0.0.1:8082/pi/"
KIOSK_DELAY_SECONDS=10
```

不要再恢复这些旧链路：

- `kiosk.service`
- 第二套 desktop autostart
- 旧 `start-kiosk.sh`

否则容易出现重复启动、白屏或打开错误页面。

## 首次初始化或配置恢复

### nginx

`/etc/nginx/sites-available/pi-app` 需要满足：

- `/pi/` 指向 `/home/noonwake/app/dist-pi/`
- `/printer/` 反代到 `http://127.0.0.1:8787/`

修改后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### kiosk 环境变量

`/home/noonwake/.config/pi-kiosk.env` 至少包含：

```bash
KIOSK_URL="http://127.0.0.1:8082/pi/"
KIOSK_DELAY_SECONDS=10
```

### autostart

`/home/noonwake/.config/labwc/autostart` 需要调用：

```bash
/home/noonwake/.local/bin/pi-kiosk-launch.sh
```

### 启动脚本

`/home/noonwake/.local/bin/pi-kiosk-launch.sh` 需要负责：

- 探测可用 Wayland display
- 按延时启动 Chromium
- 使用独立 Chromium profile
- 全屏打开 `KIOSK_URL`

## 完整验证

### 页面可访问

```bash
curl -I http://192.168.48.253:8082/pi/
curl -I http://192.168.48.253:8082/pi/print-bg.jpg
```

预期：

- 返回 `200`

### 打印服务可访问

```bash
curl http://192.168.48.253:8082/printer/health
```

预期：

- 返回 `{"ok": true, ...}`

### 浏览器已自动拉起

```bash
ssh noonwake@192.168.48.253 "pgrep -af chromium"
```

### 启动日志

```bash
ssh noonwake@192.168.48.253 "tail -20 ~/.local/state/pi-kiosk/launcher.log"
```

预期日志包含：

```text
starting kiosk url=http://127.0.0.1:8082/pi/
```

### 实际打印测试

```bash
curl -X POST 'http://192.168.48.253:8082/printer/print' \
  -H 'Content-Type: application/json' \
  --data '{"line1":"重启测试","line2":"流程正常"}'
```

注意：

- 打印服务要求每行正好 4 个汉字

## 回滚方案

### 重新构建回滚

```bash
cd /Users/wyh/G/company/open-calendar
git checkout <good_commit>
yarn build
rsync -av --delete dist-pi/ noonwake@192.168.48.253:/home/noonwake/app/dist-pi/
```

### 远端目录备份回滚

发布前先备份：

```bash
ssh noonwake@192.168.48.253 "rm -rf /home/noonwake/app/dist-pi.bak && cp -R /home/noonwake/app/dist-pi /home/noonwake/app/dist-pi.bak"
```

需要快速回滚时：

```bash
ssh noonwake@192.168.48.253 "rm -rf /home/noonwake/app/dist-pi && mv /home/noonwake/app/dist-pi.bak /home/noonwake/app/dist-pi"
```

## 常见问题

### 页面白屏

优先检查：

- `vite.config.ts` 的 `base` 是否仍为 `/pi/`
- 路由 basename 是否仍匹配 `/pi/`
- 静态资源是否通过 `publicAssetUrl` 处理
- `curl http://192.168.48.253:8082/pi/assets/...` 是否返回 `200`

### 静态资源 404

优先检查：

- 资源是否在 `public/` 下
- 页面是否还写死成 `/print-bg.jpg`
- 是否已经改为 `/pi/` 下可访问的公共资源路径

### 打印按钮只弹窗不打印

优先检查：

- 页面是否接回真实 `printer.print(...)`
- `PrintSignCard` 是否只是 UI 占位
- nginx `/printer/` 代理是否正常
- `printer/health` 是否返回 `ok: true`

### 重启后没有自动打开业务页面

优先检查：

- `~/.config/labwc/autostart`
- `~/.local/bin/pi-kiosk-launch.sh`
- `~/.config/pi-kiosk.env`
- `~/.local/state/pi-kiosk/launcher.log`
- 是否误恢复了旧的 `kiosk.service` 或旧 `start-kiosk.sh`
