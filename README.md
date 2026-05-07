# Alpha Reminder

一个用于监控 `alpha123.uk` 空投信息并通过 Bark 发送提醒的脚本。

## 当前功能

- 支持“今日空投”和“空投预告”两类通知
- 支持 `UNKNOWN` 类型项目识别与推送
- 当天已通知项目会持久化去重，重启后同一天不会重复推送
- 跨天会自动重置当天去重状态
- 前台运行时支持 `Ctrl + C` 快速退出

## 通知说明

- 标题会区分：
  - `今日空投: 项目名 (TOKEN)`
  - `空投预告: 项目名 (TOKEN)`
- 正文统一包含：
  - `所需积分`
  - `空投数量`
  - `时间`
  - `类型`
- 类型显示规则：
  - `grab` 显示为“先到先得”
  - `tge` 显示为 `TGE`
  - `pre-tge` 显示为 `Pre-TGE`
  - 未知类型按原值显示

## 常用命令

```bash
npm run run
npm run dry-run
npm run test-bark
npm test
```

- `npm run run`
  - 启动常驻监控
  - 按配置轮询 `alpha123.uk` 并发送 Bark 通知
- `npm run dry-run`
  - 抓取并输出当前识别到的新条目
  - 不发送通知
- `npm run test-bark`
  - 发送一条“安装测试通知”，用于验证 Bark 通道
- `npm test`
  - 运行本地单元测试

## 配置说明

- 配置文件来源于 `.env.example`
- 实际运行使用项目根目录下的 `.env`
- `BARK_DEVICE_KEY` 为必填项，不填写将无法推送通知

默认配置项如下：

- `ALPHA123_API_URL`
- `ALPHA123_POLL_INTERVAL_SECONDS`
- `ALPHA123_REQUEST_TIMEOUT_MS`
- `BARK_BASE_URL`
- `BARK_DEVICE_KEY`
- `BARK_SOUND`
- `BARK_GROUP`
- `BARK_LEVEL`
- `BARK_URL`

## 数据与日志

- `data/notified-airdrops.json`
  - 保存当天已通知过的条目
  - 用于重启后同一天不重复推送
- `logs/`
  - `pm2` 日志目录

## 部署方式

适用于 Ubuntu / Debian VPS，WSL Ubuntu 也可直接使用。

执行：

```bash
bash scripts/setup-linux.sh
```

安装脚本会：

- 检查并安装缺失的 `node`、`npm`、`pm2`
- 在不存在 `.env` 时根据 `.env.example` 自动生成
- 强制要求输入 `BARK_DEVICE_KEY`
- 创建 `data/` 和 `logs/`
- 执行 `npm install`
- 执行 `npm test`
- 执行 `npm run test-bark`
- 使用 `pm2` 启动服务
- 执行 `pm2 save`
- 输出 `pm2 startup` 指引，用于配置开机自启

## pm2 运行说明

- `pm2 start ecosystem.config.js`
  - 立即启动服务
- 进程异常退出或正常退出后
  - `pm2` 会自动拉起
- 机器重启后
  - 配合 `pm2 save` 和 `pm2 startup` 可以自动恢复
- 手动执行：

```bash
pm2 stop alpha-reminder
```

  - 属于人工停止，不会自动重启
