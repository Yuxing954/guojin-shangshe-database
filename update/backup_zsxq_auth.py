#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""备份知识星球 zsxq-cli 登录凭据到 update/zsxq_auth_backup.json。

原理：zsxq-cli 的 access token 以 DPAPI 加密后存在注册表
  HKCU\\Software\\ZsxqCli\\keychain\\zsxq-cli\\<base64(user_id)>
密文绑定当前 Windows 用户 + 机器，备份文件即使泄露也无法在别处解密。
同时备份 ~/.config/zsxq-cli/config.json（deviceId / users 映射）。

用法：
  python backup_zsxq_auth.py                # 写到脚本同目录 zsxq_auth_backup.json
  python backup_zsxq_auth.py -o other.json  # 指定输出
"""
import argparse
import base64
import json
import os
import sys
import time
import winreg

REG_PATH = r"Software\ZsxqCli\keychain\zsxq-cli"
CONFIG_PATH = os.path.expanduser(r"~\.config\zsxq-cli\config.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "zsxq_auth_backup.json"))
    args = ap.parse_args()

    try:
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_PATH)
    except FileNotFoundError:
        print("✗ 注册表无登录凭据（zsxq-cli 未登录或已 logout）:", REG_PATH)
        sys.exit(1)

    values = {}
    i = 0
    while True:
        try:
            name, val, _ = winreg.EnumValue(k, i)
            values[name] = val if isinstance(val, str) else base64.b64encode(val).decode()
            i += 1
        except OSError:
            break
    if not values:
        print("✗ 注册表键存在但无凭据值")
        sys.exit(1)

    config = None
    if os.path.exists(CONFIG_PATH):
        config = json.load(open(CONFIG_PATH, encoding="utf-8"))

    backup = {
        "_note": "zsxq-cli DPAPI 加密凭据备份。密文绑定备份时的 Windows 用户与机器，仅可在同一环境恢复。请勿在公开仓库存放。",
        "backed_up_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "registry": {"path": REG_PATH, "values": values},
        "config": config,
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(backup, f, ensure_ascii=False, indent=2)
    os.chmod(args.output, 0o600) if os.name != "nt" else None
    print("✓ 已备份", len(values), "条凭据 ->", args.output)
    print("  用户:", [u.get("userName") for u in (config or {}).get("users", [])])


if __name__ == "__main__":
    main()
