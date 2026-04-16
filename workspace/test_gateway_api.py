#!/usr/bin/env python3
"""测试网关API端点"""

import requests
import json

BASE_URL = "http://localhost:26976"

# 可能的端点
ENDPOINTS = [
    "/api/agent/turn",
    "/api/tool/execute", 
    "/api/tools",
    "/api/execute",
    "/v1/agent/turn",
    "/v1/tool/execute",
    "/agent/turn",
    "/tool/execute",
    "/execute",
    "/api/v1/agent/turn",
    "/api/v1/tool/execute",
]

# 测试健康端点
print("测试健康端点...")
try:
    resp = requests.get(f"{BASE_URL}/health", timeout=5)
    print(f"  /health: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"  /health 错误: {e}")

print("\n测试可能端点...")
for endpoint in ENDPOINTS:
    url = f"{BASE_URL}{endpoint}"
    print(f"\n尝试 {endpoint}:")
    
    # 尝试GET
    try:
        resp = requests.get(url, timeout=3)
        print(f"  GET: {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f"  GET 错误: {e}")
    
    # 尝试POST
    try:
        resp = requests.post(
            url,
            json={"tool": "web_search", "params": {"query": "test"}},
            timeout=3
        )
        print(f"  POST: {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f"  POST 错误: {e}")

print("\n检查 /api 目录...")
try:
    resp = requests.get(f"{BASE_URL}/api", timeout=3)
    print(f"  /api: {resp.status_code} - {resp.text[:200]}")
except Exception as e:
    print(f"  /api 错误: {e}")