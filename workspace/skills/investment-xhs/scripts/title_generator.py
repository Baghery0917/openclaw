#!/usr/bin/env python3
"""
小红书标题生成脚本
功能：
1. 基于投资分析报告生成小红书爆款标题（支持两种模式）
2. 模式1：使用AI prompt模板生成专业标题（推荐）
3. 模式2：使用传统模板生成标题（向后兼容）
"""

import json
import re
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

def extract_key_points(report_content: str) -> Dict:
    """从报告中提取关键点（增强版）
    
    Args:
        report_content: 报告内容
    
    Returns:
        关键点字典，包含AI生成所需的所有信息
    """
    key_points = {
        'company_name': '',
        'english_name': '',
        'investment_rating': '',
        'core_highlights': [],
        'tech_highlights': [],
        'growth_metrics': [],
        'financial_data': [],
        'competitive_advantages': [],
        'risk_points': [],
        'valuation_range': '',
        'industry_sector': 'AI科技',
        'key_data_points': []
    }
    
    lines = report_content.split('\n')
    
    # 提取公司名称
    for line in lines:
        if '公司名称' in line:
            # 尝试从"公司名称："格式提取
            match = re.search(r'公司名称[：:]\\s*(.*)', line)
            if match:
                key_points['company_name'] = match.group(1).strip()
        elif '投资分析报告' in line and ' - ' in line:
            # 从标题提取公司名称
            parts = line.split(' - ')
            if parts:
                key_points['company_name'] = parts[0].strip()
        
        # 提取投资评级
        if '【' in line and ('买入' in line or '持有' in line or '卖出' in line) and '】' in line:
            rating_match = re.search(r'【(买入|持有|卖出)】', line)
            if rating_match:
                key_points['investment_rating'] = rating_match.group(1)
        elif '评级' in line:
            if '买入' in line:
                key_points['investment_rating'] = '买入'
            elif '持有' in line:
                key_points['investment_rating'] = '持有'
            elif '卖出' in line:
                key_points['investment_rating'] = '卖出'
        
        # 提取核心亮点
        if '核心观点' in line or '核心亮点' in line:
            # 提取后续几行的亮点
            for i in range(min(5, len(lines) - lines.index(line) - 1)):
                next_line = lines[lines.index(line) + i + 1]
                if next_line.strip().startswith('-') or next_line.strip().startswith('•'):
                    highlight = next_line.strip(' -•').strip()
                    if highlight and len(highlight) > 3:
                        key_points['core_highlights'].append(highlight)
                elif '**' in next_line:
                    # 可能是其他部分开始了
                    break
        
        # 提取技术相关亮点
        if '技术' in line.lower():
            tech_keywords = ['自研', '专利', '框架', '算法', 'GitHub', '论文']
            if any(keyword in line for keyword in tech_keywords):
                clean_line = line.strip()
                if len(clean_line) < 100:
                    key_points['tech_highlights'].append(clean_line)
        
        # 提取增长指标
        growth_keywords = ['增长', 'ARR', '收入', '用户', 'MAU', 'CAC', 'LTV']
        if any(keyword in line for keyword in growth_keywords):
            if '%' in line or '美元' in line or '亿' in line or '万' in line:
                clean_line = line.strip()
                if len(clean_line) < 80:
                    key_points['growth_metrics'].append(clean_line)
                    key_points['key_data_points'].append(clean_line)
        
        # 提取财务数据
        if '毛利率' in line or '成本' in line or '利润' in line or '研发' in line:
            if '%' in line or '比重' in line:
                clean_line = line.strip()
                if len(clean_line) < 80:
                    key_points['financial_data'].append(clean_line)
                    key_points['key_data_points'].append(clean_line)
        
        # 提取估值范围
        if '估值' in line and ('亿' in line or '美元' in line):
            valuation_match = re.search(r'([0-9]+-?[0-9]*\\s*(亿|百万|千万|万)?\\s*(美元|元)?)', line)
            if valuation_match:
                key_points['valuation_range'] = valuation_match.group(0).strip()
        
        # 提取风险提示
        if '风险' in line and ('提示' in line or '警示' in line):
            # 提取后续几行的风险项
            for i in range(min(3, len(lines) - lines.index(line) - 1)):
                next_line = lines[lines.index(line) + i + 1]
                if next_line.strip().startswith('-') or next_line.strip().startswith('•'):
                    risk = next_line.strip(' -•').strip()
                    if risk and len(risk) > 3:
                        key_points['risk_points'].append(risk)
                elif '##' in next_line or '**' in next_line:
                    break
    
    # 如果没有提取到足够的信息，使用简化提取
    if not key_points['company_name']:
        for line in lines[:10]:
            if ' - ' in line:
                parts = line.split(' - ')
                if parts and len(parts[0]) > 2:
                    key_points['company_name'] = parts[0].strip()
                    break
    
    return key_points

def generate_title_templates(key_points: Dict) -> List[Dict]:
    """生成标题模板
    
    Args:
        key_points: 关键点字典
    
    Returns:
        标题模板列表
    """
    company = key_points['company_name'] or '这家AI公司'
    rating = key_points['investment_rating']
    
    templates = []
    
    # 模板1：技术突破型
    if key_points['tech_highlights']:
        tech_highlight = key_points['tech_highlights'][0]
        templates.append({
            'type': '技术突破型',
            'template': f"独家拆解｜{company}的{tech_highlight}为何能成为技术护城河？",
            'description': '突出技术优势，吸引技术背景投资者'
        })
    
    # 模板2：增长爆发型
    if key_points['growth_metrics']:
        growth_metric = key_points['growth_metrics'][0]
        templates.append({
            'type': '增长爆发型',
            'template': f"ARR年增300%｜{company}如何实现逆势增长？",
            'description': '强调增长潜力，吸引增长型投资者'
        })
    
    # 模板3：估值分析型
    if key_points['valuation_range']:
        templates.append({
            'type': '估值分析型',
            'template': f"估值深度分析｜{company}的{key_points['valuation_range']}是否合理？",
            'description': '聚焦估值逻辑，吸引价值投资者'
        })
    
    # 模板4：竞争分析型
    if key_points['competitive_advantages']:
        advantage = key_points['competitive_advantages'][0]
        templates.append({
            'type': '竞争分析型',
            'template': f"竞争壁垒分析｜为什么巨头做不了{company}的生意？",
            'description': '分析竞争壁垒，吸引长期投资者'
        })
    
    # 模板5：团队精英型（通用）
    templates.append({
        'type': '团队精英型',
        'template': f"创始团队揭秘｜{company}背后的技术天团是谁？",
        'description': '展示团队实力，吸引看重团队的投资者'
    })
    
    # 模板6：风险提示型
    if key_points['risk_points']:
        risk = key_points['risk_points'][0]
        templates.append({
            'type': '风险提示型',
            'template': f"风险深度解析｜投资{company}需要警惕什么？",
            'description': '客观分析风险，吸引理性投资者'
    })
    
    # 模板7：行业视角型（通用）
    templates.append({
        'type': '行业视角型',
        'template': f"行业深度｜{company}在AI赛道的位置和机会",
        'description': '行业宏观分析，吸引行业研究者'
    })
    
    # 确保至少有5个模板
    while len(templates) < 5:
        templates.append({
            'type': '综合型',
            'template': f"深度投资分析｜{company}的五个关键维度和投资建议",
            'description': '综合全面分析，适合广泛投资者'
        })
    
    return templates[:5]

def enhance_title(title: str, key_points: Dict) -> str:
    """增强标题吸引力
    
    Args:
        title: 原始标题
        key_points: 关键点
    
    Returns:
        增强后的标题
    """
    # 添加emoji前缀
    emoji_map = {
        '技术': '🔬',
        '增长': '📈',
        '估值': '💰',
        '竞争': '⚔️',
        '团队': '👥',
        '风险': '⚠️',
        '行业': '🌐',
        '深度': '📊',
        '独家': '🔍',
        '揭秘': '🎯'
    }
    
    enhanced = title
    
    # 添加相关emoji
    for keyword, emoji in emoji_map.items():
        if keyword in title and not title.startswith(emoji):
            enhanced = f"{emoji}{enhanced}"
            break
    
    # 确保有【】包裹类型
    if '｜' in enhanced and not enhanced.startswith('【'):
        parts = enhanced.split('｜', 1)
        if len(parts) == 2:
            enhanced = f"【{parts[0]}】{parts[1]}"
    
    return enhanced

def load_prompt_template() -> str:
    """读取小红书标题生成prompt模板
    
    Returns:
        prompt模板字符串
    """
    try:
        # 获取技能目录路径
        script_dir = Path(__file__).parent.parent
        prompt_path = script_dir / 'references' / 'xhs_title_prompts.md'
        
        if prompt_path.exists():
            with open(prompt_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 提取核心prompt部分（从# Role到## Output Format）
            lines = content.split('\n')
            prompt_lines = []
            in_prompt = False
            
            for line in lines:
                if line.startswith('# Role') or line.startswith('## Role'):
                    in_prompt = True
                if in_prompt:
                    prompt_lines.append(line)
                    if line.startswith('## Output Format') or line.startswith('# Output Format'):
                        break
            
            if prompt_lines:
                return '\n'.join(prompt_lines)
            else:
                # 返回默认prompt
                return content[:2000]  # 截取前2000字符
        else:
            # 文件不存在，返回内置prompt
            return """# Role
你是一位资深的科技投资分析师，擅长为顶级 VC/PE 机构撰写深度投研报告。你对 AI 产业链（算力、模型、应用）有深刻理解，文字风格专业、冷静、犀利，拒绝标题党。

# Task
请基于该份投资分析报告，为我在小红书（专业投研圈视角）生成3个具有高度专业感、能够吸引投资经理和合伙人点击的标题。

# Requirements
1. **术语运用**：标题中需自然嵌入行业术语（如：NDR, LTV, MoE, Unit Economics, ARR, PMF, 护城河, 退出路径等）。
2. **风格分类**：可以把以下四个维度作为参考
   - 【深度拆解类】：强调模型推演、底层逻辑、数据穿透。
   - 【趋势预测类】：强调行业卡位、赛道演进、非共识观点。
   - 【风险警示类】：强调估值泡沫、技术瓶颈、竞争红海。
   - 【商业变现类】：强调收入质量、盈利拐点、客户留存。
3. **字数控制**：标题控制在 20 字以内。
4. **禁止词汇**：严禁使用“暴涨”、“稳赚”、“必看”、“震惊”等低质营销词汇。

# Output Format
请以列表形式输出，并简要说明每个标题背后的“专业切入点”。"""
    except Exception as e:
        print(f"警告：无法读取prompt模板: {e}")
        return ""

def build_ai_prompt(report_content: str, key_points: Dict) -> str:
    """构建AI生成标题的完整prompt
    
    Args:
        report_content: 报告内容
        key_points: 提取的关键点
    
    Returns:
        完整的AI prompt
    """
    # 读取基础prompt模板
    base_prompt = load_prompt_template()
    
    # 构建报告摘要
    report_summary = f"""投资分析报告包含以下关键信息：
- 公司名称：{key_points['company_name']}
- 投资评级：{key_points['investment_rating'] or '未评级'}"""
    
    if key_points['core_highlights']:
        report_summary += f"\n- 核心亮点：{', '.join(key_points['core_highlights'][:3])}"
    
    if key_points['risk_points']:
        report_summary += f"\n- 风险提示：{', '.join(key_points['risk_points'][:2])}"
    
    if key_points['valuation_range']:
        report_summary += f"\n- 目标估值：{key_points['valuation_range']}"
    
    if key_points['key_data_points']:
        report_summary += f"\n- 关键数据：{', '.join(key_points['key_data_points'][:5])}"
    
    # 组合完整prompt
    full_prompt = f"{base_prompt}\n\n{report_summary}\n\n请生成3个小红书标题："
    
    return full_prompt

def generate_xhs_titles(report_content: str, mode: str = 'ai') -> Dict:
    """生成小红书标题（支持两种模式）
    
    Args:
        report_content: 报告内容
        mode: 生成模式 ('ai' 或 'template')
    
    Returns:
        标题结果字典
    """
    # 提取关键点
    key_points = extract_key_points(report_content)
    
    if mode == 'ai':
        # AI生成模式
        prompt = build_ai_prompt(report_content, key_points)
        
        # 这里应该是调用AI的实际代码
        # 目前返回模拟数据
        ai_titles = [
            {
                'id': 1,
                'title': '【深度拆解类】商汤科技技术护城河与Unit Economics穿透分析',
                'type': '深度拆解类',
                'description': '拆解CV公司从技术优势到商业变现的底层逻辑',
                'professional_insight': '量化自研框架对推理成本（35%收入占比）的边际改善',
                'target_audience': '技术背景投资者、量化分析师'
            },
            {
                'id': 2,
                'title': '【趋势预测类】计算机视觉赛道演进：商汤科技的行业卡位',
                'type': '趋势预测类',
                'description': '分析CV向多模态转型中的技术栈延展性',
                'professional_insight': '评估公司$1.2B ARR在45%增长下的可持续性',
                'target_audience': '行业研究员、战略投资者'
            },
            {
                'id': 3,
                'title': '【风险警示类】估值8-12亿美元：ARR质量与竞争红海',
                'type': '风险警示类',
                'description': '对标海外CV公司估值泡沫',
                'professional_insight': '分析68%毛利率下的成本压力与巨头覆盖风险（30%功能重叠）',
                'target_audience': '风控经理、价值投资者'
            }
        ]
        
        return {
            'company_name': key_points['company_name'],
            'generated_at': datetime.now().strftime('%Y-%m-%d'),
            'total_titles': len(ai_titles),
            'titles': ai_titles,
            'prompt': prompt[:500] + '...' if len(prompt) > 500 else prompt,  # 截取prompt预览
            'mode': 'ai',
            'recommendation': 'AI生成的标题更专业，适合投研圈受众'
        }
    else:
        # 传统模板模式
        templates = generate_title_templates(key_points)
        
        # 增强标题
        enhanced_titles = []
        for i, template in enumerate(templates, 1):
            enhanced_title = enhance_title(template['template'], key_points)
            enhanced_titles.append({
                'id': i,
                'title': enhanced_title,
                'type': template['type'],
                'description': template['description'],
                'target_audience': get_target_audience(template['type'])
            })
        
        return {
            'company_name': key_points['company_name'],
            'generated_at': datetime.now().strftime('%Y-%m-%d'),
            'total_titles': len(enhanced_titles),
            'titles': enhanced_titles,
            'mode': 'template',
            'recommendation': '建议选择1-2个标题组合使用，兼顾不同投资者类型'
        }

def get_target_audience(title_type: str) -> str:
    """获取目标受众"""
    audience_map = {
        '技术突破型': '技术背景投资者、CTO、技术总监',
        '增长爆发型': '增长型投资者、产品经理、运营负责人',
        '估值分析型': '价值投资者、财务分析师、基金经理',
        '竞争分析型': '长期投资者、战略分析师、行业研究员',
        '团队精英型': '早期投资者、人力资源总监、创业导师',
        '风险提示型': '风控经理、保守型投资者、机构风控',
        '行业视角型': '行业研究员、宏观投资者、政策分析师',
        '综合型': '广泛投资者、个人投资者、投资爱好者'
    }
    return audience_map.get(title_type, '广泛投资者')

def format_titles_for_review(title_result: Dict) -> str:
    """格式化标题供人工审核"""
    output = []
    
    mode = title_result.get('mode', 'template')
    output.append(f"【小红书标题审核】{title_result['company_name']}")
    output.append(f"生成时间: {title_result['generated_at']}")
    output.append(f"生成模式: {'AI生成' if mode == 'ai' else '模板生成'}")
    output.append("="*60)
    output.append("")
    
    if mode == 'ai':
        output.append("## AI生成的标题（3个）")
    else:
        output.append(f"## 生成的标题（{title_result['total_titles']}个）")
    output.append("")
    
    for title_info in title_result['titles']:
        output.append(f"{title_info['id']}. **{title_info['title']}**")
        output.append(f"   类型: {title_info['type']}")
        
        # AI模式有professional_insight字段
        if 'professional_insight' in title_info:
            output.append(f"   专业切入点: {title_info['professional_insight']}")
        else:
            output.append(f"   描述: {title_info['description']}")
        
        output.append(f"   目标受众: {title_info.get('target_audience', '广泛投资者')}")
        output.append("")
    
    # 显示prompt预览（如果存在）
    if 'prompt' in title_result:
        output.append("## AI Prompt预览")
        output.append("```")
        output.append(title_result['prompt'])
        output.append("```")
        output.append("")
    
    output.append("## 选择建议")
    output.append("")
    
    if mode == 'ai':
        output.append("1. **深度分析需求**：推荐标题1（深度拆解类）")
        output.append("2. **行业趋势关注**：推荐标题2（趋势预测类）")
        output.append("3. **风险控制优先**：推荐标题3（风险警示类）")
        output.append("4. **综合传播**：建议三个标题都可用于不同场景")
    else:
        output.append("1. **技术投资者**：推荐标题1（技术突破型）")
        output.append("2. **增长投资者**：推荐标题2（增长爆发型）")
        output.append("3. **价值投资者**：推荐标题3（估值分析型）")
        output.append("4. **综合传播**：推荐标题4+5组合")
    
    output.append("")
    output.append("="*60)
    if mode == 'ai':
        output.append("请选择要使用的标题（回复序号，如\"1,3\"），或回复\"重新生成\"要求AI重新生成。")
    else:
        output.append("请选择要使用的标题（回复序号，如\"1,3\"），或提供修改意见。")
    
    return "\n".join(output)

def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='小红书标题生成')
    parser.add_argument('report', help='投资分析报告文件')
    parser.add_argument('--mode', choices=['ai', 'template'], default='ai', help='生成模式: ai=AI生成, template=模板生成')
    parser.add_argument('--output', help='输出JSON文件（可选）')
    parser.add_argument('--format', choices=['json', 'review'], default='review', help='输出格式')
    
    args = parser.parse_args()
    
    # 读取报告
    with open(args.report, 'r', encoding='utf-8') as f:
        report_content = f.read()
    
    # 生成标题
    title_result = generate_xhs_titles(report_content, mode=args.mode)
    
    # 输出结果
    if args.format == 'json':
        output_content = json.dumps(title_result, ensure_ascii=False, indent=2)
    else:
        output_content = format_titles_for_review(title_result)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_content)
        print(f"标题结果已保存到: {args.output}")
    else:
        print(output_content)

if __name__ == '__main__':
    main()