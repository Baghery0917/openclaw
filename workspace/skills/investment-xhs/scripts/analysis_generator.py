#!/usr/bin/env python3
"""
深度投资分析生成脚本
功能：
1. 整理研究数据为上下文
2. 调用DeepSeek Reasoner进行深度分析
3. 生成结构化投资分析报告
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

def prepare_context(research_data: Dict, reliability_report: Dict = None) -> str:
    """准备分析上下文
    
    Args:
        research_data: 研究数据
        reliability_report: 可靠性报告（可选）
    
    Returns:
        格式化后的上下文字符串
    """
    company_name = research_data.get('company_name', '未知公司')
    
    context_parts = []
    
    # 公司基本信息
    context_parts.append(f"# {company_name} - 投资分析上下文")
    context_parts.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    context_parts.append("")
    
    # 各维度信息
    dimension_names = {
        'technology': '技术维度',
        'growth': '增长维度',
        'cost': '成本维度',
        'competition': '竞争维度',
        'team': '团队维度'
    }
    
    for dim_key, dim_name in dimension_names.items():
        if dim_key in research_data.get('dimensions', {}):
            items = research_data['dimensions'][dim_key].get('info', [])
            if items:
                context_parts.append(f"## {dim_name}")
                context_parts.append("")
                
                for item in items:
                    reliability = item.get('reliability', 'C')
                    source = item.get('source', '未知来源')
                    date = item.get('date', '未知日期')
                    
                    context_parts.append(f"- 【{reliability}级】{item.get('aspect', '')}: {item.get('info', '')}")
                    context_parts.append(f"  来源: {source} ({date})")
                context_parts.append("")
    
    # 可靠性总结
    if reliability_report:
        summary = reliability_report.get('summary', {})
        if summary:
            context_parts.append("## 信息可靠性总结")
            context_parts.append("")
            context_parts.append(f"- 总体可靠性: {summary.get('overall_reliability', 'C')}级")
            context_parts.append(f"- 总体得分: {summary.get('overall_score', 0)}/4.0")
            context_parts.append(f"- 总信息条数: {summary.get('total_items', 0)}")
            context_parts.append("")
            
            if summary.get('validation_recommendations'):
                context_parts.append("### 验证建议")
                for rec in summary['validation_recommendations']:
                    context_parts.append(f"- {rec}")
                context_parts.append("")
    
    # 分析指令
    context_parts.append("## 分析要求")
    context_parts.append("")
    context_parts.append("请基于以上信息，生成一份专业的投资分析报告。报告需包含：")
    context_parts.append("")
    context_parts.append("1. **执行摘要**（300字以内）")
    context_parts.append("   - 核心投资观点（买入/持有/卖出）")
    context_parts.append("   - 目标估值区间（如适用）")
    context_parts.append("   - 关键投资逻辑")
    context_parts.append("   - 主要风险提示")
    context_parts.append("")
    context_parts.append("2. **公司概况**")
    context_parts.append("   - 基本信息（成立时间、总部、业务模式）")
    context_parts.append("   - 发展里程碑")
    context_parts.append("   - 融资历史")
    context_parts.append("")
    context_parts.append("3. **五维深度分析**")
    context_parts.append("   - 技术维度：自研能力、专利、数据壁垒")
    context_parts.append("   - 增长维度：财务表现、用户增长、市场拓展")
    context_parts.append("   - 成本维度：成本结构、效率指标、控制能力")
    context_parts.append("   - 竞争维度：竞争格局、差异化、风险评估")
    context_parts.append("   - 团队维度：核心团队、人才结构、治理结构")
    context_parts.append("")
    context_parts.append("4. **行业分析**")
    context_parts.append("   - 市场规模和增长")
    context_parts.append("   - 行业趋势")
    context_parts.append("   - 行业风险")
    context_parts.append("")
    context_parts.append("5. **财务预测**（未来3年）")
    context_parts.append("   - 关键假设")
    context_parts.append("   - 损益表预测")
    context_parts.append("   - 现金流预测")
    context_parts.append("")
    context_parts.append("6. **估值分析**")
    context_parts.append("   - 估值方法（可比公司、DCF等）")
    context_parts.append("   - 估值区间")
    context_parts.append("   - 敏感性分析")
    context_parts.append("")
    context_parts.append("7. **投资建议**")
    context_parts.append("   - 投资评级（买入/持有/卖出）")
    context_parts.append("   - 投资逻辑")
    context_parts.append("   - 风险提示（高/中/低风险）")
    context_parts.append("")
    context_parts.append("8. **风险提示与免责声明**")
    context_parts.append("")
    context_parts.append("**注意**：")
    context_parts.append("- 基于提供的信息可靠性进行评估")
    context_parts.append("- 对于可靠性较低的信息，需注明不确定性")
    context_parts.append("- 保持专业、客观的分析态度")
    context_parts.append("- 报告结构清晰，逻辑严谨")
    
    return "\n".join(context_parts)

def generate_analysis_prompt(context: str) -> str:
    """生成DeepSeek Reasoner的分析prompt"""
    prompt = f"""你是一位专业的投资分析师，请基于以下信息生成一份深度投资分析报告。

{context}

请生成完整的投资分析报告，严格遵循上述结构要求。报告需专业、客观、数据驱动，并充分考虑信息的可靠性。

请直接输出完整的报告内容，不要包含额外的解释或说明。"""
    
    return prompt

def save_analysis_report(report_content: str, company_name: str, output_dir: str = None) -> str:
    """保存分析报告
    
    Args:
        report_content: 报告内容
        company_name: 公司名称
        output_dir: 输出目录
    
    Returns:
        保存的文件路径
    """
    if output_dir is None:
        workspace = os.environ.get('OPENCLAW_WORKSPACE', '/root/.openclaw/workspace')
        output_dir = Path(workspace) / 'memory' / 'analysis_reports'
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成文件名
    safe_name = ''.join(c if c.isalnum() else '_' for c in company_name)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"analysis_{safe_name}_{timestamp}.md"
    filepath = output_dir / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    print(f"分析报告已保存到: {filepath}")
    return str(filepath)

def format_for_review(report_content: str, company_name: str) -> str:
    """格式化报告供人工审核"""
    output = []
    output.append(f"【深度分析报告审核】{company_name}")
    output.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output.append("="*60)
    output.append("")
    
    # 截取报告前部分供审核
    lines = report_content.split('\n')
    preview_lines = min(100, len(lines))  # 预览前100行
    
    output.extend(lines[:preview_lines])
    
    if len(lines) > preview_lines:
        output.append("")
        output.append(f"...（报告共{len(lines)}行，此处显示前{preview_lines}行）")
        output.append("完整报告已保存，审核通过后将用于后续步骤。")
    
    output.append("")
    output.append("="*60)
    output.append("请审核以上报告内容，确认无误后回复\"批准生成标题\"。")
    
    return "\n".join(output)

def main():
    """命令行入口（测试用）"""
    import argparse
    
    parser = argparse.ArgumentParser(description='深度投资分析生成')
    parser.add_argument('research', help='研究数据JSON文件')
    parser.add_argument('--reliability', help='可靠性报告JSON文件（可选）')
    parser.add_argument('--output', help='输出目录')
    
    args = parser.parse_args()
    
    # 读取研究数据
    with open(args.research, 'r', encoding='utf-8') as f:
        research_data = json.load(f)
    
    # 读取可靠性报告（如果有）
    reliability_report = None
    if args.reliability:
        with open(args.reliability, 'r', encoding='utf-8') as f:
            reliability_report = json.load(f)
    
    # 准备上下文
    context = prepare_context(research_data, reliability_report)
    
    print("="*60)
    print("分析上下文已准备:")
    print("="*60)
    print(context[:1000] + "..." if len(context) > 1000 else context)
    print("="*60)
    
    company_name = research_data.get('company_name', '测试公司')
    
    # 生成prompt
    prompt = generate_analysis_prompt(context)
    
    print("\n" + "="*60)
    print("分析Prompt已生成")
    print("="*60)
    print("提示：实际分析需调用DeepSeek Reasoner")
    print(f"公司: {company_name}")
    print(f"上下文长度: {len(context)} 字符")
    print("="*60)
    
    # 模拟报告内容
    mock_report = f"""# {company_name} - 投资分析报告

## 执行摘要

基于当前信息，我们对{company_name}给出【持有】评级。公司技术实力较强，增长势头良好，但面临成本控制和竞争压力。

**核心观点**：
- 技术护城河初显，自研能力值得关注
- 增长数据积极，但需验证可持续性
- 成本结构有待优化，毛利率压力存在
- 竞争格局复杂，差异化优势需强化

**目标估值**: 8-12亿美元（基于可比公司分析）

**主要风险**: 技术商业化不及预期、竞争加剧、成本控制挑战

## 公司概况

（此处为完整的分析报告内容...）

*注：此为模拟报告，实际报告需通过DeepSeek Reasoner生成。*
"""
    
    # 保存模拟报告
    report_path = save_analysis_report(mock_report, company_name, args.output)
    
    # 格式化供审核
    review_text = format_for_review(mock_report, company_name)
    print("\n" + review_text)

if __name__ == '__main__':
    main()