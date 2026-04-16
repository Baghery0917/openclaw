#!/usr/bin/env python3
"""
信息可靠性评估脚本
功能：
1. 对收集的信息进行可靠性评级
2. 交叉验证检查
3. 生成可靠性报告
"""

import json
from typing import Dict, List, Tuple

def evaluate_reliability(source_type: str, source_url: str = None) -> Tuple[str, str]:
    """评估单个信息来源的可靠性
    
    Args:
        source_type: 来源类型（如'官网'、'财报'、'媒体报道'等）
        source_url: 来源URL（可选，用于进一步分析）
    
    Returns:
        (reliability_level, explanation) 可靠性等级和说明
    """
    reliability_rules = {
        'A': {
            'sources': ['官网公告', '财务报表', 'SEC备案', '专利局', '政府文件'],
            'description': '官方第一手资料，最高可靠性'
        },
        'B': {
            'sources': ['权威媒体', '分析师报告', '学术论文', '行业报告', '知名机构'],
            'description': '权威第三方分析，高可靠性'
        },
        'C': {
            'sources': ['一般媒体', '社交媒体官方', '数据平台', '招聘网站', '用户评价'],
            'description': '一般来源，中等可靠性，需交叉验证'
        },
        'D': {
            'sources': ['匿名爆料', '未验证传闻', '营销号', '小道消息'],
            'description': '低可靠性，仅作参考'
        }
    }
    
    # 匹配规则
    for level, rule in reliability_rules.items():
        for pattern in rule['sources']:
            if pattern in source_type:
                return level, rule['description']
    
    # 默认根据URL判断
    if source_url:
        if 'gov.' in source_url or '.gov.' in source_url:
            return 'A', '政府官方网站'
        elif 'sec.gov' in source_url or '证监会' in source_url:
            return 'A', '证券监管机构'
        elif 'github.com' in source_url:
            return 'B', 'GitHub开源代码仓库'
        elif 'arxiv.org' in source_url:
            return 'B', '学术论文预印本'
        elif 'linkedin.com' in source_url:
            return 'C', 'LinkedIn职业资料'
    
    # 默认等级
    return 'C', '未知来源，默认中等可靠性'

def cross_validate_items(items: List[Dict]) -> Dict:
    """对信息条目进行交叉验证
    
    Args:
        items: 信息条目列表，每个条目需有'info'和'source'字段
    
    Returns:
        验证结果字典
    """
    if len(items) < 2:
        return {'validated': False, 'message': '条目不足，无法交叉验证'}
    
    # 按信息内容分组
    info_groups = {}
    for item in items:
        info_key = item['info'][:50]  # 取前50字符作为关键信息
        if info_key not in info_groups:
            info_groups[info_key] = []
        info_groups[info_key].append(item)
    
    validation_results = {}
    
    for info_key, group in info_groups.items():
        if len(group) > 1:
            # 有多个来源验证同一信息
            sources = [item['source'] for item in group]
            reliability_levels = [item.get('reliability', 'C') for item in group]
            
            # 检查可靠性等级一致性
            if all(r == 'A' for r in reliability_levels):
                validation_level = 'A+'
                validation_desc = '多个A级来源验证，可靠性极高'
            elif 'A' in reliability_levels and 'B' in reliability_levels:
                validation_level = 'A'
                validation_desc = 'A级+B级来源验证，可靠性高'
            elif 'B' in reliability_levels and len(set(reliability_levels)) >= 2:
                validation_level = 'B+'
                validation_desc = '多个B级以上来源验证，可靠性较高'
            else:
                validation_level = 'B'
                validation_desc = '多个来源验证，可靠性中等'
            
            validation_results[info_key] = {
                'validation_level': validation_level,
                'description': validation_desc,
                'sources': sources,
                'reliability_levels': reliability_levels,
                'item_count': len(group)
            }
        else:
            # 单一来源
            item = group[0]
            validation_results[info_key] = {
                'validation_level': item.get('reliability', 'C'),
                'description': '单一来源，未交叉验证',
                'sources': [item['source']],
                'reliability_levels': [item.get('reliability', 'C')],
                'item_count': 1
            }
    
    return validation_results

def generate_reliability_report(research_data: Dict) -> Dict:
    """生成完整的可靠性评估报告
    
    Args:
        research_data: 研究数据，包含五个维度的信息
    
    Returns:
        可靠性报告
    """
    report = {
        'company_name': research_data.get('company_name', '未知公司'),
        'evaluation_date': research_data.get('collection_date', ''),
        'dimensions': {},
        'summary': {}
    }
    
    total_items = 0
    reliability_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0}
    
    for dim_name, dim_data in research_data.get('dimensions', {}).items():
        items = dim_data.get('info', [])
        total_items += len(items)
        
        dim_report = {
            'item_count': len(items),
            'items': [],
            'reliability_distribution': {'A': 0, 'B': 0, 'C': 0, 'D': 0},
            'average_reliability': 'C'
        }
        
        for item in items:
            # 如果条目没有可靠性评估，则进行评估
            if 'reliability' not in item:
                reliability, explanation = evaluate_reliability(item.get('source', ''), item.get('url'))
                item['reliability'] = reliability
                item['reliability_explanation'] = explanation
            
            # 统计可靠性分布
            reliability_counts[item['reliability']] += 1
            dim_report['reliability_distribution'][item['reliability']] += 1
            
            dim_report['items'].append({
                'aspect': item.get('aspect', ''),
                'reliability': item['reliability'],
                'source': item.get('source', ''),
                'validation_needed': item['reliability'] in ['C', 'D']
            })
        
        # 计算维度平均可靠性
        if len(items) > 0:
            reliability_scores = {'A': 4, 'B': 3, 'C': 2, 'D': 1}
            avg_score = sum(reliability_scores.get(item['reliability'], 2) for item in items) / len(items)
            
            if avg_score >= 3.5:
                dim_report['average_reliability'] = 'A'
            elif avg_score >= 2.5:
                dim_report['average_reliability'] = 'B'
            elif avg_score >= 1.5:
                dim_report['average_reliability'] = 'C'
            else:
                dim_report['average_reliability'] = 'D'
        
        # 交叉验证
        if len(items) >= 2:
            validation_results = cross_validate_items(items)
            dim_report['cross_validation'] = validation_results
        
        report['dimensions'][dim_name] = dim_report
    
    # 生成摘要
    if total_items > 0:
        reliability_percentages = {k: v/total_items*100 for k, v in reliability_counts.items()}
        
        overall_score = (
            reliability_counts['A'] * 4 +
            reliability_counts['B'] * 3 +
            reliability_counts['C'] * 2 +
            reliability_counts['D'] * 1
        ) / total_items if total_items > 0 else 0
        
        if overall_score >= 3.5:
            overall_reliability = 'A'
            overall_desc = '信息整体可靠性高'
        elif overall_score >= 2.5:
            overall_reliability = 'B'
            overall_desc = '信息整体可靠性中等偏高'
        elif overall_score >= 1.5:
            overall_reliability = 'C'
            overall_desc = '信息整体可靠性中等，部分需验证'
        else:
            overall_reliability = 'D'
            overall_desc = '信息整体可靠性低，需谨慎使用'
        
        report['summary'] = {
            'total_items': total_items,
            'reliability_distribution': reliability_counts,
            'reliability_percentages': reliability_percentages,
            'overall_reliability': overall_reliability,
            'overall_description': overall_desc,
            'overall_score': round(overall_score, 2),
            'validation_recommendations': []
        }
        
        # 生成验证建议
        if reliability_counts['C'] + reliability_counts['D'] > total_items * 0.3:
            report['summary']['validation_recommendations'].append(
                '超过30%的信息可靠性为C/D级，建议进行交叉验证'
            )
        
        if reliability_counts['A'] < total_items * 0.2:
            report['summary']['validation_recommendations'].append(
                'A级信息不足20%，建议寻找更多官方来源'
            )
    
    return report

def format_reliability_report(report: Dict, format_type: str = 'markdown') -> str:
    """格式化可靠性报告
    
    Args:
        report: 可靠性报告字典
        format_type: 输出格式（markdown/text）
    
    Returns:
        格式化后的报告字符串
    """
    if format_type == 'markdown':
        return _format_markdown(report)
    else:
        return _format_text(report)

def _format_markdown(report: Dict) -> str:
    """生成Markdown格式报告"""
    output = []
    
    output.append(f"# 信息可靠性评估报告")
    output.append(f"**公司名称**: {report['company_name']}")
    output.append(f"**评估日期**: {report['evaluation_date']}")
    output.append("")
    
    # 摘要部分
    summary = report.get('summary', {})
    if summary:
        output.append("## 评估摘要")
        output.append("")
        
        reliability_emoji = {'A': '🟢', 'B': '🟡', 'C': '🟠', 'D': '🔴'}
        
        output.append(f"**总体可靠性**: {reliability_emoji.get(summary['overall_reliability'], '⚪')} {summary['overall_reliability']}级 - {summary['overall_description']}")
        output.append(f"**总体得分**: {summary['overall_score']}/4.0")
        output.append("")
        
        output.append("### 可靠性分布")
        for level in ['A', 'B', 'C', 'D']:
            count = summary['reliability_distribution'].get(level, 0)
            percent = summary['reliability_percentages'].get(level, 0)
            output.append(f"- {reliability_emoji.get(level, '⚪')} {level}级: {count}条 ({percent:.1f}%)")
        
        output.append("")
        
        if summary.get('validation_recommendations'):
            output.append("### 验证建议")
            for rec in summary['validation_recommendations']:
                output.append(f"- ⚠️ {rec}")
            output.append("")
    
    # 各维度详情
    output.append("## 各维度可靠性分析")
    output.append("")
    
    dimension_names = {
        'technology': '技术维度',
        'growth': '增长维度',
        'cost': '成本维度',
        'competition': '竞争维度',
        'team': '团队维度'
    }
    
    for dim_key, dim_name in dimension_names.items():
        if dim_key in report['dimensions']:
            dim_report = report['dimensions'][dim_key]
            output.append(f"### {dim_name}")
            output.append(f"- 信息条数: {dim_report['item_count']}")
            output.append(f"- 平均可靠性: {dim_report['average_reliability']}级")
            output.append("")
            
            if dim_report['items']:
                output.append("#### 详细信息")
                for item in dim_report['items']:
                    emoji = reliability_emoji.get(item['reliability'], '⚪')
                    validation_flag = "⚠️" if item['validation_needed'] else "✅"
                    output.append(f"{validation_flag} **{item['aspect']}**: {emoji}{item['reliability']}级 (来源: {item['source']})")
                output.append("")
    
    output.append("---")
    output.append("*评估说明: A级=官方第一手资料, B级=权威第三方, C级=一般来源, D级=低可靠性*")
    
    return "\n".join(output)

def _format_text(report: Dict) -> str:
    """生成纯文本格式报告（简化版）"""
    output = []
    
    output.append(f"信息可靠性评估报告 - {report['company_name']}")
    output.append(f"评估日期: {report['evaluation_date']}")
    output.append("="*50)
    
    summary = report.get('summary', {})
    if summary:
        output.append(f"总体可靠性: {summary['overall_reliability']}级 - {summary['overall_description']}")
        output.append(f"总体得分: {summary['overall_score']}/4.0")
        output.append("")
        
        output.append("可靠性分布:")
        for level in ['A', 'B', 'C', 'D']:
            count = summary['reliability_distribution'].get(level, 0)
            percent = summary['reliability_percentages'].get(level, 0)
            output.append(f"  {level}级: {count}条 ({percent:.1f}%)")
    
    return "\n".join(output)

def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='信息可靠性评估')
    parser.add_argument('input', help='输入的研究数据JSON文件')
    parser.add_argument('--output', help='输出报告文件（可选）')
    parser.add_argument('--format', choices=['json', 'markdown', 'text'], default='markdown', help='输出格式')
    
    args = parser.parse_args()
    
    # 读取输入数据
    with open(args.input, 'r', encoding='utf-8') as f:
        research_data = json.load(f)
    
    # 生成可靠性报告
    report = generate_reliability_report(research_data)
    
    # 输出报告
    if args.format == 'json':
        output_content = json.dumps(report, ensure_ascii=False, indent=2)
    elif args.format == 'markdown':
        output_content = format_reliability_report(report, 'markdown')
    else:
        output_content = format_reliability_report(report, 'text')
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_content)
        print(f"报告已保存到: {args.output}")
    else:
        print(output_content)

if __name__ == '__main__':
    main()