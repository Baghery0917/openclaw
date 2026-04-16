#!/usr/bin/env python3
"""
摘要和标签生成脚本
功能：
1. 生成小红书文案摘要
2. 生成相关标签
3. 格式化最终交付内容
"""

import json
import re
from datetime import datetime
from typing import Dict, List, Tuple

def extract_report_essentials(report_content: str) -> Dict:
    """提取报告核心要素"""
    essentials = {
        'company_name': '',
        'investment_rating': '',
        'key_strengths': [],
        'key_risks': [],
        'valuation_info': '',
        'industry_sector': 'AI科技'
    }
    
    lines = report_content.split('\n')
    
    # 提取公司名称
    for line in lines:
        if '公司名称' in line:
            essentials['company_name'] = line.split('公司名称')[-1].strip(' :：')
            break
        elif ' - ' in line and '投资分析报告' in line:
            essentials['company_name'] = line.split(' - ')[0].strip()
            break
    
    # 提取投资评级
    for line in lines:
        line_lower = line.lower()
        if '买入' in line and ('评级' in line or '建议' in line):
            essentials['investment_rating'] = '买入'
            break
        elif '持有' in line and ('评级' in line or '建议' in line):
            essentials['investment_rating'] = '持有'
            break
        elif '卖出' in line and ('评级' in line or '建议' in line):
            essentials['investment_rating'] = '卖出'
            break
    
    # 提取关键优势
    strength_keywords = ['优势', '亮点', '强项', '护城河', '差异化']
    for line in lines:
        if any(keyword in line for keyword in strength_keywords):
            clean_line = line.strip()
            if len(clean_line) < 100:  # 避免过长
                essentials['key_strengths'].append(clean_line)
    
    # 提取关键风险
    risk_keywords = ['风险', '挑战', '问题', '不足', '弱点']
    for line in lines:
        if any(keyword in line for keyword in risk_keywords):
            clean_line = line.strip()
            if len(clean_line) < 100:
                essentials['key_risks'].append(clean_line)
    
    # 提取估值信息
    for line in lines:
        if '估值' in line and ('亿' in line or '美元' in line or '万' in line):
            essentials['valuation_info'] = line.strip()
            break
    
    return essentials

def generate_xhs_summary(essentials: Dict) -> str:
    """生成小红书文案摘要"""
    company = essentials['company_name']
    rating = essentials['investment_rating'] or '持有'
    
    # Emoji映射
    rating_emoji = {'买入': '🚀', '持有': '📊', '卖出': '⚠️'}
    strength_emoji = ['💪', '🌟', '🎯', '🔥', '✨']
    risk_emoji = ['⚠️', '🚧', '🌀', '💥']
    sector_emoji = '🤖'
    
    summary_parts = []
    
    # 标题
    summary_parts.append(f"{rating_emoji.get(rating, '📈')}【AI投资分析】{company}")
    summary_parts.append("")
    
    # 评级和估值
    summary_parts.append(f"{sector_emoji} **投资评级**: {rating}")
    if essentials['valuation_info']:
        summary_parts.append(f"💰 **估值参考**: {essentials['valuation_info']}")
    summary_parts.append("")
    
    # 核心优势
    if essentials['key_strengths']:
        summary_parts.append("🌟 **核心亮点**:")
        for i, strength in enumerate(essentials['key_strengths'][:3]):  # 最多3个
            emoji = strength_emoji[i % len(strength_emoji)]
            # 简化描述
            simple_strength = re.sub(r'[【】《》「」]', '', strength)
            simple_strength = simple_strength[:50]  # 限制长度
            summary_parts.append(f"{emoji} {simple_strength}")
        summary_parts.append("")
    
    # 关键风险
    if essentials['key_risks']:
        summary_parts.append("⚠️ **风险提示**:")
        for i, risk in enumerate(essentials['key_risks'][:2]):  # 最多2个
            emoji = risk_emoji[i % len(risk_emoji)]
            simple_risk = re.sub(r'[【】《》「」]', '', risk)
            simple_risk = simple_risk[:50]
            summary_parts.append(f"{emoji} {simple_risk}")
        summary_parts.append("")
    
    # 投资建议
    summary_parts.append("📋 **投资建议**:")
    if rating == '买入':
        summary_parts.append("✅ 适合关注成长性的投资者")
        summary_parts.append("✅ 建议分批建仓，长期持有")
    elif rating == '持有':
        summary_parts.append("🔄 适合现有持仓者继续观察")
        summary_parts.append("🔄 新投资者可等待更好时机")
    else:
        summary_parts.append("⏸️ 建议谨慎，关注风险变化")
        summary_parts.append("⏸️ 现有持仓者考虑减仓")
    summary_parts.append("")
    
    # 结尾
    summary_parts.append("---")
    summary_parts.append("📊 完整报告包含五维深度分析")
    summary_parts.append("🔍 技术+增长+成本+竞争+团队")
    summary_parts.append("📈 数据驱动，专业客观")
    
    # 添加免责声明
    summary_parts.append("")
    summary_parts.append("*投资有风险，入市需谨慎*")
    summary_parts.append("*本文仅供参考，不构成投资建议*")
    
    return "\n".join(summary_parts)

def generate_xhs_tags(essentials: Dict, num_tags: int = 5) -> List[str]:
    """生成小红书标签"""
    company = essentials['company_name']
    sector = essentials['industry_sector']
    rating = essentials['investment_rating']
    
    # 基础标签库
    base_tags = [
        f'#{sector}投资',
        '#AI投资分析',
        '#科技股研究',
        '#投资理财',
        '#财务分析'
    ]
    
    # 公司相关标签
    company_tags = []
    if company:
        # 使用公司名创建标签（简短版）
        short_name = company[:4] if len(company) > 4 else company
        company_tags = [
            f'#{short_name}深度分析',
            f'#{short_name}投资价值'
        ]
    
    # 评级相关标签
    rating_tags = []
    if rating:
        rating_map = {'买入': '#买入评级', '持有': '#持有评级', '卖出': '#卖出评级'}
        if rating in rating_map:
            rating_tags.append(rating_map[rating])
    
    # 行业细分标签
    sector_tags = [
        '#人工智能',
        '#机器学习',
        '#科技创业',
        '#数字经济'
    ]
    
    # 组合所有标签
    all_tags = company_tags + rating_tags + base_tags + sector_tags
    
    # 去重并限制数量
    unique_tags = []
    for tag in all_tags:
        if tag not in unique_tags and len(tag) <= 20:  # 标签长度限制
            unique_tags.append(tag)
        if len(unique_tags) >= num_tags:
            break
    
    return unique_tags[:num_tags]

def generate_final_delivery(summary: str, tags: List[str], title: str = None, image_note: str = None) -> Dict:
    """生成最终交付内容"""
    delivery = {
        'timestamp': datetime.now().isoformat(),
        'summary': summary,
        'tags': tags,
        'delivery_format': {
            '小红书文案': summary,
            '标签': ' '.join(tags),
            '使用说明': '可直接复制到小红书发布'
        }
    }
    
    if title:
        delivery['title'] = title
        delivery['delivery_format']['标题'] = title
    
    if image_note:
        delivery['image_note'] = image_note
        delivery['delivery_format']['图片说明'] = image_note
    
    return delivery

def format_delivery_for_review(delivery: Dict) -> str:
    """格式化交付内容供审核"""
    output = []
    
    output.append("【最终交付审核】")
    output.append(f"生成时间: {delivery['timestamp']}")
    output.append("="*60)
    output.append("")
    
    if 'title' in delivery:
        output.append("## 标题")
        output.append("")
        output.append(delivery['title'])
        output.append("")
    
    output.append("## 小红书文案摘要")
    output.append("")
    output.append(delivery['summary'])
    output.append("")
    
    output.append("## 标签")
    output.append("")
    output.append(' '.join(delivery['tags']))
    output.append("")
    
    if 'image_note' in delivery:
        output.append("## 图片说明")
        output.append("")
        output.append(delivery['image_note'])
        output.append("")
    
    output.append("## 使用说明")
    output.append("")
    output.append("1. 复制文案摘要到小红书")
    output.append("2. 添加标签")
    output.append("3. 上传报告截图")
    output.append("4. 发布内容")
    output.append("")
    
    output.append("="*60)
    output.append("审核通过后回复\"批准发布\"，内容将准备就绪。")
    
    return "\n".join(output)

def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='摘要和标签生成')
    parser.add_argument('report', help='投资分析报告文件')
    parser.add_argument('--title', help='已选定的标题（可选）')
    parser.add_argument('--image', help='图片文件路径或说明（可选）')
    parser.add_argument('--output', help='输出JSON文件（可选）')
    parser.add_argument('--format', choices=['json', 'review'], default='review', help='输出格式')
    
    args = parser.parse_args()
    
    # 读取报告
    with open(args.report, 'r', encoding='utf-8') as f:
        report_content = f.read()
    
    # 提取核心要素
    essentials = extract_report_essentials(report_content)
    
    # 生成摘要
    summary = generate_xhs_summary(essentials)
    
    # 生成标签
    tags = generate_xhs_tags(essentials, 5)
    
    # 生成最终交付内容
    delivery = generate_final_delivery(summary, tags, args.title, args.image)
    
    # 输出结果
    if args.format == 'json':
        output_content = json.dumps(delivery, ensure_ascii=False, indent=2)
    else:
        output_content = format_delivery_for_review(delivery)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_content)
        print(f"交付内容已保存到: {args.output}")
    else:
        print(output_content)

if __name__ == '__main__':
    main()