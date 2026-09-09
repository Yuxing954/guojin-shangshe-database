#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 update/zsxq_auth_backup.json 恢复 zsxq-cli 登录凭据。

场景：zsxq-cli 登录态丢失（连接器重连、auth logout、清理配置等）时，
免重新扫码授权，直接恢复注册表中的 DPAPI 密文与 config.json。
仅限与备份时相同的 Windows 用户 + 机器（DPAPI 绑定）。

用法：
  python restore_zsxq_auth.py                 # 恢复 + zsxq-cli auth status 验证
  python restore_zsxq_auth.py -f backup.json  # 指定备份文件
"""
import argparse
import json
import os
import subprocess
import sys
import winreg

ZSXQ_CLI = os.environ.get("ZSXQ_CLI", "zsxq-cli")
CONFIG_PATH = os.path.expanduser(r"~\.config\zsxq-cli\config.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-f", "--file", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "zsxq_auth_backup.json"))
    ap.add_argument("--no-verify", action="store_true", help="恢复后不运行 zsxq-cli auth status")
    args = ap.parse_args()

    if not os.path.exists(args.file):
        print("✗ 备份文件不存在:", args.file)
        sys.exit(1)
    backup = json.load(open(args.file, encoding="utf-8"))
    reg = backup["registry"]
    print("备份时间:", backup.get("backed_up_at"))

    key = winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, reg["path"], 0, winreg.KEY_SET_VALUE)
    for name, val in reg["values"].items():
        # 备份时二进制值以 base64 存放；本工具当前只处理字符串型（DPAPI 密文按 REG_SZ 存储）
        winreg.SetValueEx(key, name, 0, winreg.REG_SZ, val)
    winreg.CloseKey(key)
    print("✓ 注册表凭据已恢复:", reg["path"], "(", len(reg["values"]), "条 )")

    if backup.get("config"):
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(backup["config"], f, ensure_ascii=False, indent=2)
        print("✓ config.json 已恢复")

    if not args.no_verify:
        r = subprocess.run([ZSXQ_CLI, "auth", "status"], capture_output=True, text=True, shell=(os.name == "nt"))
        out = (r.stdout or "") + (r.stderr or "")
        if r.returncode == 0 and "Logged in as" in out:
            print("✓ 验证通过:", out.strip().splitlines()[0])
        else:
            print("✗ 验证失败（DPAPI 绑定不匹配或备份过旧），请重新扫码授权：zsxq-cli auth login")
            sys.exit(2)


if __name__ == "__main__":
    main()
