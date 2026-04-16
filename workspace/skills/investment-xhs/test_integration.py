#!/usr/bin/env python3
"""集成测试：测试Tavily搜索是否在研究收集器中工作"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 设置API密钥
os.environ['TAVILY_API_KEY'] = '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'

from scripts.research_collector import ResearchCollector

def main():
    print("测试Tavily搜索集成...")
    print("=" * 60)
    
    # 创建收集器（默认模式应为'tavily'）
    collector = ResearchCollector('商汤科技')
    
    print(f"搜索模式: {collector.search_mode}")
    print(f"搜索提供者模式: {collector.search_provider.mode}")
    
    # 只收集技术维度信息（避免过多API调用）
    print("\n收集技术维度信息...")
    tech_result = collector.collect_technology_info()
    
    print(f"收集到 {tech_result['count']} 条技术信息")
    
    # 显示结果
    for i, item in enumerate(tech_result['items'][:3], 1):
        print(f"{i}. {item['aspect']}: {item['info'][:80]}...")
        print(f"   可靠性: {item['reliability']}, 来源: {item['source']}")
        if item.get('url'):
            print(f"   URL: {item['url'][:80]}...")
        print()
    
    # 检查是否使用了真实搜索
    stats = collector.search_provider.get_search_stats()
    print(f"搜索统计: {stats['total_searches']} 次搜索")
    print(f"使用模式: {stats['modes_used']}")
    
    # 保存结果
    output_file = collector.save_results()
    print(f"\n结果已保存到: {output_file}")
    
    # 格式化审核文本
    review_text = collector.format_for_review()
    print("\n审核文本预览（前500字符）:")
    print(review_text[:500])
    
    print("\n" + "=" * 60)
    print("集成测试完成")
    
    # 检查是否有真实数据
    has_real_data = any('example.com' not in item.get('url', '') for item in tech_result['items'])
    if has_real_data:
        print("✅ 检测到真实搜索数据")
    else:
        print("⚠️ 可能仍在使用模拟数据，请检查API密钥和网络连接")

if __name__ == '__main__':
    main()