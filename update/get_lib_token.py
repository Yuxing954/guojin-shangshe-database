# -*- coding: utf-8 -*-
"""
自动铸造新鲜的资料库 op_ token（绕过 30 分钟过期的正确姿势：不缓存，即用即铸）。

原理：运行环境变量 CODEBUDDY_MCP_CONFIG 中包含本地连接器代理
（127.0.0.1:58845）的地址与鉴权头，代理可调用内置工具 connect_open_platform，
每次返回一个全新的 op_ token（TTL 30 分钟，从铸造时刻起算）。

用法：
  python get_lib_token.py          # stdout 输出 op_ token（单行）
  失败时 exit 1 并输出中文错误到 stderr

限制：仅在配置了 CODEBUDDY_MCP_CONFIG 环境变量的运行环境中可用；
运行环境重启后，旧代理地址或凭据可能失效，需重新运行。
"""
import json, os, sys, urllib.request

def get_proxy_config():
    raw = os.environ.get("CODEBUDDY_MCP_CONFIG")
    if not raw:
        raise RuntimeError("CODEBUDDY_MCP_CONFIG 环境变量不存在——请在已配置的运行环境中执行，或手动提供 op_ token")
    cfg = json.loads(raw)
    proxy = (cfg.get("mcpServers") or {}).get("connector-proxy")
    if not proxy:
        raise RuntimeError("CODEBUDDY_MCP_CONFIG 中没有 connector-proxy 配置")
    return proxy["url"], proxy.get("headers", {})

def rpc(url, headers, payload, session=None):
    h = dict(headers)
    h["Content-Type"] = "application/json"
    h["Accept"] = "application/json, text/event-stream"
    if session:
        h["mcp-session-id"] = session
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        sid = r.headers.get("mcp-session-id")
        body = r.read().decode()
    if body.startswith("event:") or "\ndata:" in body or body.startswith("data:"):
        data = None
        for line in body.splitlines():
            if line.startswith("data:"):
                data = json.loads(line[5:].strip())
        return data, sid
    return (json.loads(body) if body.strip() else None), sid

def mint_token(skill_id="library"):
    url, headers = get_proxy_config()
    _, sid = rpc(url, headers, {"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {
        "protocolVersion": "2025-03-26", "capabilities": {},
        "clientInfo": {"name": "wb-token-minter", "version": "1.0"}}})
    rpc(url, headers, {"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
    r, _ = rpc(url, headers, {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                              "params": {"name": "connect_open_platform",
                                         "arguments": {"skill_id": skill_id}}}, sid)
    if not r or "result" not in r:
        raise RuntimeError(f"connect_open_platform 调用失败: {json.dumps(r, ensure_ascii=False)[:200]}")
    # result.content[0].text 是 JSON 字符串（含 token / expiresIn）
    blocks = r["result"].get("content") or []
    text = next((b.get("text", "") for b in blocks if b.get("type") == "text"), "")
    # 结构化内容也可能直接在 structuredContent
    sc = r["result"].get("structuredContent") or {}
    token = sc.get("token")
    if not token:
        try:
            token = json.loads(text).get("token")
        except Exception:
            pass
    if not token:
        # 兜底：正则抓 op_ 开头的 token
        import re
        m = re.search(r"op_[A-Za-z0-9]+", text)
        token = m.group(0) if m else None
    if not token:
        raise RuntimeError(f"未解析到 token: {text[:200]}")
    return token

if __name__ == "__main__":
    try:
        print(mint_token())
    except Exception as e:
        print(f"获取 token 失败: {e}", file=sys.stderr)
        sys.exit(1)
