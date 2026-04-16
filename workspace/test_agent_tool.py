#!/usr/bin/env python3
"""测试通过agent执行工具调用"""

import subprocess
import json
import time

def test_agent_tool_call():
    """测试通过agent调用web_search"""
    
    # 方法1: 直接发送工具调用指令
    cmd = ["openclaw", "agent", "--message", "执行web_search: 月之暗面 AI公司"]
    
    print(f"执行命令: {' '.join(cmd)}")
    
    try:
        # 启动进程
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # 等待一段时间
        time.sleep(5)
        
        # 检查输出
        stdout, stderr = proc.communicate(timeout=5)
        
        print(f"标准输出:\n{stdout[:500]}")
        print(f"标准错误:\n{stderr[:500]}")
        
        return stdout
    except subprocess.TimeoutExpired:
        proc.kill()
        print("命令超时")
        return None
    except Exception as e:
        print(f"错误: {e}")
        return None

def test_with_input():
    """测试通过标准输入与agent交互"""
    
    cmd = ["openclaw", "agent"]
    
    print(f"执行命令: {' '.join(cmd)} (交互模式)")
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # 发送消息
        input_msg = "web_search query='月之暗面 AI公司' count=3\n"
        print(f"发送输入: {input_msg}")
        
        stdout, stderr = proc.communicate(input=input_msg, timeout=10)
        
        print(f"标准输出:\n{stdout[:1000]}")
        print(f"标准错误:\n{stderr[:500]}")
        
        return stdout
    except Exception as e:
        print(f"错误: {e}")
        return None

if __name__ == "__main__":
    print("="*60)
    print("测试agent工具调用")
    print("="*60)
    
    # 测试方法1
    print("\n测试方法1: 直接消息")
    result1 = test_agent_tool_call()
    
    # 测试方法2
    print("\n测试方法2: 交互模式")
    result2 = test_with_input()
    
    print("\n" + "="*60)
    print("测试完成")
    print("="*60)