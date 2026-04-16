#!/bin/bash

# ========== lightclawbot 插件前置检查脚本 ==========
# 用途：快速判断 lightclawbot 插件是否可用
# 特点：
#   1. 减少文件 I/O 次数（一次读取配置文件，复用解析结果）
#   2. 与 OpenClaw 源码逻辑保持一致（plugins.enabled/deny/allow/entries）
#   3. 支持传参指定插件 ID
#
# 输出：最后一行固定为 RESULT:{...} JSON，供前端解析
#   - 可用：       RESULT:{"status":"ok","version":"x.y.z"}
#   - 缺 openclaw：RESULT:{"status":"need_openclaw","reason":"...","desc":"..."}
#   - 需要安装/配置：RESULT:{"status":"need_install","reason":"...","desc":"..."}
#   - reason: 固定错误码（前端用于判断分支）
#   - desc:   检测命令的实际输出（可选，用于排查问题）
#
# 使用方式：
#   本地执行：  bash preflight.sh [plugin_id]
#   CDN 执行：  bash <(curl -fsSL https://your-cdn.com/preflight.sh) [plugin_id]
#   默认检查：  lightclawbot

# ---------- 配置 ----------
id="${1:-lightclawbot}"           # 支持传参指定插件 ID
cfg="$HOME/.openclaw/openclaw.json"
plugin_dir="$HOME/.openclaw/extensions/${id}"

# ---------- 加载 nvm 环境 ----------
# bash xxx.sh 启动的是非交互式 shell，不会自动 source ~/.bashrc，
# 如果用户通过 nvm 安装 node，脚本中的 node / openclaw 命令都找不到。
# 提前加载 nvm，让后续所有步骤都能使用 nvm 管理的 node。
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ---------- 工具函数 ----------
result_exit() {
  local status="$1"
  local reason="$2"
  local desc="${3:-}"
  local exit_code="${4:-1}"
  # 转义 desc 中的特殊字符，保证输出合法 JSON
  desc="${desc//\\/\\\\}"
  desc="${desc//\"/\\\"}"
  desc="${desc//$'\n'/\\n}"
  desc="${desc//$'\r'/}"
  if [ -n "$desc" ]; then
    echo "RESULT:{\"status\":\"${status}\",\"reason\":\"${reason}\",\"desc\":\"${desc}\"}"
  else
    echo "RESULT:{\"status\":\"${status}\",\"reason\":\"${reason}\"}"
  fi
  exit "$exit_code"
}

result_ok() {
  echo "RESULT:{\"status\":\"ok\",\"version\":\"${1}\"}"
  exit 0
}

# ---------- 1. 检查配置文件是否存在 ----------

if [ ! -f "$cfg" ]; then
  result_exit "error" "config_not_found" "$(ls "$cfg" 2>&1)"
fi

# ---------- 2. 验证配置文件 JSON 格式 ----------
# openclaw 通过即 node 可用，用 node 做一次轻量校验

json_check_output=$(node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$cfg" 2>&1)
if [ $? -ne 0 ]; then
  result_exit "error" "config_json_invalid" "$json_check_output"
fi

# ---------- 3. 检查 openclaw 是否可用 ----------

if ! command -v openclaw &>/dev/null; then
  oc_which_output=$(which openclaw 2>&1) || true
  result_exit "error" "openclaw_not_available" "${oc_which_output:-openclaw not found in PATH=${PATH}}"
fi

# ---------- 3a. 检查 openclaw 版本是否满足最低要求 ----------

min_version="2026.2.3"
# 兼容多种输出格式：
#   "OpenClaw 2026.3.24 (cff6dc9)"  →  2026.3.24
#   "2026.2.3"                       →  2026.2.3
oc_version_output=$(openclaw -v 2>&1)
current_version=$(echo "$oc_version_output" | head -1 | sed 's/[()]//g' | grep -oE '[0-9]{4}\.[0-9]+\.[0-9]+' | head -1)

if [ -z "$current_version" ]; then
  result_exit "error" "openclaw_version_unknown" "$oc_version_output"
fi

# 比较版本号：将 a.b.c 转为数值后逐段比较
version_lt() {
  local IFS='.'
  local i a=($1) b=($2)
  for ((i = 0; i < 3; i++)); do
    if (( ${a[i]:-0} < ${b[i]:-0} )); then return 0; fi
    if (( ${a[i]:-0} > ${b[i]:-0} )); then return 1; fi
  done
  return 1  # 相等时不算小于
}

if version_lt "$current_version" "$min_version"; then
  result_exit "error" "openclaw_version_too_old" "current: ${current_version}, required: >=${min_version}"
fi

# ---------- 3b. 检查 Gateway 是否可用 ----------

gateway_output=$(openclaw gateway health --json 2>&1)
if [ $? -ne 0 ]; then
  result_exit "need_install" "gateway_not_healthy" "$gateway_output"
fi

# ---------- 4. 检查插件目录是否已安装 ----------

if [ ! -d "$plugin_dir" ] || [ ! -f "$plugin_dir/package.json" ]; then
  result_exit "need_install" "plugin_not_installed" "$(ls -la "$plugin_dir/package.json" 2>&1)"
fi

# ---------- 5. 单次 node 调用完成所有配置项检查 ----------
# 一次启动 V8，顺序执行全部校验
# 通过环境变量安全传参，避免 shell 注入风险
# 输出格式：RESULT:{...} 与 bash 工具函数保持一致

PREFLIGHT_CFG="$cfg" PREFLIGHT_ID="$id" PREFLIGHT_PLUGIN_DIR="$plugin_dir" \
node -e '
  const fs = require("fs");
  const cfgPath   = process.env.PREFLIGHT_CFG;
  const pluginId  = process.env.PREFLIGHT_ID;
  const pluginDir = process.env.PREFLIGHT_PLUGIN_DIR;

  function fail(status, reason, desc) {
    const obj = { status, reason };
    if (desc !== undefined) obj.desc = String(desc);
    console.log("RESULT:" + JSON.stringify(obj));
    process.exit(1);
  }

  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

  // 5a. 全局插件系统检查（plugins.enabled 默认 true，仅显式 false 禁用）
  if (cfg.plugins?.enabled === false) {
    fail("need_install", "plugins_globally_disabled", "plugins.enabled = " + JSON.stringify(cfg.plugins?.enabled));
  }

  // 5b. deny 黑名单（优先级高于 allow，与 OpenClaw 源码一致）
  if (Array.isArray(cfg.plugins?.deny) && cfg.plugins.deny.includes(pluginId)) {
    fail("need_install", "plugin_in_denylist", "plugins.deny = " + JSON.stringify(cfg.plugins.deny));
  }

  // 5c. plugins.entries 启用状态
  if (cfg.plugins?.entries?.[pluginId]?.enabled !== true) {
    fail("need_install", "plugin_not_enabled", "plugins.entries." + pluginId + ".enabled = " + JSON.stringify(cfg.plugins?.entries?.[pluginId]?.enabled));
  }

  // 5d. allow 白名单（非空时必须在列表中）
  const allow = cfg.plugins?.allow;
  if (Array.isArray(allow) && allow.length > 0 && !allow.includes(pluginId)) {
    fail("need_install", "plugin_not_in_allowlist", "plugins.allow = " + JSON.stringify(allow));
  }

  // 5e. plugins.installs 安装记录（可选，仅警告，默认不阻塞）
  // 如需严格检查，取消下面的注释：
  // if (!cfg.plugins?.installs?.[pluginId]) {
  //   fail("need_install", "plugin_install_record_missing", "plugins.installs." + pluginId + " = " + JSON.stringify(cfg.plugins?.installs?.[pluginId]));
  // }

  // 5f. channels 启用状态
  if (cfg.channels?.[pluginId]?.enabled !== true) {
    fail("need_install", "channel_not_enabled", "channels." + pluginId + ".enabled = " + JSON.stringify(cfg.channels?.[pluginId]?.enabled));
  }

  // 5g. channels apiKeys 配置
  const apiKeys = cfg.channels?.[pluginId]?.apiKeys;
  if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
    fail("need_install", "apikeys_empty", "channels." + pluginId + ".apiKeys = " + JSON.stringify(apiKeys));
  }

  // 5h. 读取插件版本
  let version = "unknown";
  try {
    const pkg = JSON.parse(fs.readFileSync(pluginDir + "/package.json", "utf8"));
    version = pkg.version || "unknown";
  } catch (e) {}

  // 全部通过
  console.log("RESULT:" + JSON.stringify({ status: "ok", version }));
'

# 将 node 的退出码传递给 bash
exit $?