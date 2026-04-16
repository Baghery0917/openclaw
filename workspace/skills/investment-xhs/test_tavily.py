#!/usr/bin/env python3
"""测试Tavily搜索集成"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scripts.research_collector import SearchProvider

# 设置环境变量
os.environ['TAVILY_API_KEY'] = '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'

def test_tavily_search():
    """测试Tavily搜索"""
    print("测试Tavily搜索...")
    
    provider = SearchProvider(mode='tavily')
    
    # 测试搜索
    results = provider.search('OpenAI', dimension='technology')
    
    print(f"获取到 {len(results)} 条结果:")
    for i, result in enumerate(results[:3], 1):
        print(f"{i}. {result.get('title')}")
        print(f"   片段: {result.get('snippet', '')[:100]}...")
        print(f"   URL: {result.get('url')}")
    
    # 获取搜索统计
    stats = provider.get_search_stats()
    print(f"\n搜索统计:")
    print(f"  总搜索次数: {stats['total_searches']}")
    print(f"  使用的模式: {stats['modes_used']}")
    
    return len(results) > 0

def test_company_info():
    """测试公司信息收集"""
    print("\n测试公司信息收集...")
    
    from scripts.research_collector import ResearchCollector
    
    collector = ResearchCollector('商汤科技', search_mode='tavily')
    
    # 只收集技术维度信息以节省时间
    tech_info = collector.collect_technology_info()
    
    print(f"收集到 {tech_info['count']} 条技术信息:")
    for i, item in enumerate(tech_info['items'][:2], 1):
        print(f"{i}. {item['aspect']}: {item['info']}")
        print(f"   可靠性: {item['reliability']}, 来源: {item['source']}")
    
    return tech_info['count'] > 0

if __name__ == '__main__':
    print("=" * 60)
    print("Tavily搜索集成测试")
    print("=" * 60)
    
    success1 = test_tavily_search()
    
    if success1:
        print("\n✅ Tavily搜索测试成功")
    else:
        print("\n❌ Tavily搜索测试失败")
    
    # 测试公司信息收集（可选）
    try:
        success2 = test_company_info()
        if success2:
            print("\n✅ 公司信息收集测试成功")
        else:
            print("\n❌ 公司信息收集测试失败")
    except Exception as e:
        print(f"\n⚠️ 公司信息收集测试出错: {e}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)