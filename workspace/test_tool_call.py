#!/usr/bin/env python3
"""测试OpenClaw工具调用"""

import os
import sys
import subprocess
import json
import time

def test_web_search_via_cli():
    """通过openclaw CLI测试web_search"""
    print("测试通过CLI调用web_search...")
    
    # 尝试使用openclaw agent命令
    # openclaw agent --message "web_search query='test'"  ?
    
    # 或者尝试直接调用工具
    cmd = ["openclaw", "agent", "--message", "执行web_search: test"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        print(f"返回码: {result.returncode}")
        print(f"标准输出: {result.stdout[:500]}")
        print(f"标准错误: {result.stderr[:500]}")
        return result
    except Exception as e:
        print(f"CLI调用失败: {e}")
        return None

def test_gateway_api():
    """测试网关API"""
    print("\n测试网关API...")
    
    # 尝试不同的端点
    endpoints = [
        "/api/v1/tools/execute",
        "/v1/tools/execute", 
        "/tools/execute",
        "/execute",
        "/api/execute"
    ]
    
    import requests
    
    for endpoint in endpoints:
        url = f"http://localhost:26976{endpoint}"
        print(f"尝试端点: {endpoint}")
        try:
            response = requests.post(
                url,
                json={"tool": "web_search", "params": {"query": "test"}},
                timeout=5
            )
            print(f"  状态码: {response.status_code}")
            if response.status_code != 404:
                print(f"  响应: {response.text[:200]}")
                return response.json()
        except Exception as e:
            print(f"  错误: {e}")
    
    return None

def check_available_tools():
    """检查可用工具"""
    print("\n检查可用工具...")
    
    # 查看配置
    config_path = os.path.expanduser("~/.openclaw/config.json")
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
            print(f"配置找到: {config_path}")
            if 'tools' in config:
                print(f"工具配置: {json.dumps(config['tools'], indent=2)}")
    
    # 检查环境变量
    print("\n相关环境变量:")
    for key, value in os.environ.items():
        if 'OPENCLAW' in key or 'TOOL' in key or 'WEB' in key:
            print(f"  {key}={value}")

if __name__ == "__main__":
    print("="*60)
    print("OpenClaw工具调用测试")
    print("="*60)
    
    # 检查配置和环境
    check_available_tools()
    
    # 测试API
    # result = test_gateway_api()
    
    # 测试CLI
    result = test_web_search_via_cli()
    
    print("\n" + "="*60)
    print("测试完成")
    print("="*60)