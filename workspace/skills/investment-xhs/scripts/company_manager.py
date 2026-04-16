#!/usr/bin/env python3
"""
公司名单管理脚本
功能：
1. 读取/维护AI科技公司名单
2. 检查重复和分析记录
3. 添加新公司
4. 选择待分析公司
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

class CompanyManager:
    def __init__(self, data_dir: str = None):
        """初始化公司管理器
        
        Args:
            data_dir: 数据目录路径，默认为workspace/memory目录
        """
        if data_dir is None:
            # 假设在OpenClaw workspace环境中
            workspace = os.environ.get('OPENCLAW_WORKSPACE', '/root/.openclaw/workspace')
            self.data_dir = Path(workspace) / 'memory'
        else:
            self.data_dir = Path(data_dir)
        
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.companies_file = self.data_dir / 'companies.json'
        
        # 初始化公司数据
        self.companies = self._load_companies()
    
    def _load_companies(self) -> Dict[str, Any]:
        """加载公司数据"""
        if self.companies_file.exists():
            with open(self.companies_file, 'r', encoding='utf-8') as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    print(f"警告：无法解析 {self.companies_file}，使用初始数据")
                    return self._get_initial_data()
        else:
            return self._get_initial_data()
    
    def _get_initial_data(self) -> Dict[str, Any]:
        """获取初始公司数据"""
        # 尝试从assets目录加载初始数据
        script_dir = Path(__file__).parent.parent
        initial_file = script_dir / 'assets' / 'initial_companies.json'
        
        if initial_file.exists():
            with open(initial_file, 'r', encoding='utf-8') as f:
                initial_data = json.load(f)
                # 添加管理字段
                for company in initial_data.get('companies', []):
                    company.setdefault('last_analysis_date', None)
                    company.setdefault('analysis_count', 0)
                    company.setdefault('tags', [])
                
                return {
                    'companies': initial_data.get('companies', []),
                    'last_updated': datetime.now().strftime('%Y-%m-%d'),
                    'total_companies': len(initial_data.get('companies', [])),
                    'version': '1.0'
                }
        else:
            # 返回空结构
            return {
                'companies': [],
                'last_updated': datetime.now().strftime('%Y-%m-%d'),
                'total_companies': 0,
                'version': '1.0'
            }
    
    def save_companies(self):
        """保存公司数据到文件"""
        self.companies['last_updated'] = datetime.now().strftime('%Y-%m-%d')
        self.companies['total_companies'] = len(self.companies['companies'])
        
        with open(self.companies_file, 'w', encoding='utf-8') as f:
            json.dump(self.companies, f, ensure_ascii=False, indent=2)
    
    def get_company_by_name(self, name: str) -> Optional[Dict]:
        """根据名称获取公司信息"""
        for company in self.companies['companies']:
            if company['name'] == name or company.get('english_name') == name:
                return company
        return None
    
    def add_company(self, company_data: Dict) -> bool:
        """添加新公司
        
        Args:
            company_data: 公司数据，必须包含name字段
        
        Returns:
            True if added, False if duplicate
        """
        # 检查是否已存在
        existing = self.get_company_by_name(company_data['name'])
        if existing:
            print(f"公司 {company_data['name']} 已存在")
            return False
        
        # 设置默认字段
        company_data.setdefault('last_analysis_date', None)
        company_data.setdefault('analysis_count', 0)
        company_data.setdefault('tags', [])
        company_data.setdefault('founded_year', None)
        company_data.setdefault('headquarters', '')
        company_data.setdefault('core_business', '')
        company_data.setdefault('funding_stage', '')
        company_data.setdefault('last_funding_date', '')
        
        self.companies['companies'].append(company_data)
        self.save_companies()
        print(f"已添加公司: {company_data['name']}")
        return True
    
    def update_analysis_date(self, company_name: str, analysis_date: str = None):
        """更新公司分析日期
        
        Args:
            company_name: 公司名称
            analysis_date: 分析日期，默认为今天
        """
        company = self.get_company_by_name(company_name)
        if not company:
            print(f"未找到公司: {company_name}")
            return
        
        if analysis_date is None:
            analysis_date = datetime.now().strftime('%Y-%m-%d')
        
        company['last_analysis_date'] = analysis_date
        company['analysis_count'] = company.get('analysis_count', 0) + 1
        self.save_companies()
        print(f"已更新 {company_name} 的分析日期为 {analysis_date}")
    
    def get_candidate_companies(self, days_threshold: int = 365, max_candidates: int = 5) -> List[Dict]:
        """获取待分析的公司候选列表
        
        Args:
            days_threshold: 距离上次分析的天数阈值（默认365天）
            max_candidates: 最大候选数量
        
        Returns:
            候选公司列表
        """
        candidates = []
        today = datetime.now()
        
        for company in self.companies['companies']:
            # 检查是否从未分析过
            if company['last_analysis_date'] is None:
                candidates.append(company)
                continue
            
            # 检查上次分析是否超过阈值天数
            try:
                last_date = datetime.strptime(company['last_analysis_date'], '%Y-%m-%d')
                days_since = (today - last_date).days
                if days_since >= days_threshold:
                    candidates.append(company)
            except ValueError:
                # 日期格式错误，视为从未分析
                candidates.append(company)
            
            if len(candidates) >= max_candidates:
                break
        
        return candidates
    
    def search_new_companies(self, keywords: List[str] = None) -> List[Dict]:
        """搜索新公司（模拟功能，实际需调用web搜索）
        
        Args:
            keywords: 搜索关键词
        
        Returns:
            新发现的公司列表
        """
        if keywords is None:
            keywords = ['AI创业公司', '人工智能融资', 'AI初创企业']
        
        # 这里应该是调用web搜索的实际逻辑
        # 目前返回模拟数据
        print(f"搜索关键词: {keywords}")
        print("注：实际实现需调用web_search工具")
        
        # 模拟返回几个新公司
        mock_new_companies = [
            {
                'name': '智象科技',
                'english_name': 'ZhiXiang Tech',
                'founded_year': 2022,
                'headquarters': '深圳',
                'core_business': 'AI视频生成、数字人直播',
                'funding_stage': 'A轮',
                'last_funding_date': '2024-01-15',
                'tags': ['AI视频', '数字人', '直播', 'AIGC']
            },
            {
                'name': '星图认知',
                'english_name': 'StarMap Cognition',
                'founded_year': 2023,
                'headquarters': '上海',
                'core_business': '多模态大模型、AI图像理解',
                'funding_stage': '天使轮',
                'last_funding_date': '2024-02-01',
                'tags': ['多模态', '图像理解', '大模型', '认知智能']
            }
        ]
        
        return mock_new_companies
    
    def export_selection_for_review(self, candidates: List[Dict]) -> str:
        """导出候选公司供人工审核
        
        Args:
            candidates: 候选公司列表
        
        Returns:
            格式化字符串，用于微信发送
        """
        if not candidates:
            return "【AI投资分析】今日无可分析的公司候选。\n\n建议：\n1. 检查公司名单是否需要更新\n2. 搜索新公司加入名单"
        
        today = datetime.now().strftime('%Y-%m-%d')
        message = f"【AI投资分析】{today} 公司候选列表\n\n"
        
        for i, company in enumerate(candidates, 1):
            message += f"{i}. {company['name']}"
            if company.get('english_name'):
                message += f" ({company['english_name']})"
            
            message += f"\n   核心业务: {company.get('core_business', 'N/A')}\n"
            
            if company['last_analysis_date']:
                message += f"   上次分析: {company['last_analysis_date']} ({(datetime.now() - datetime.strptime(company['last_analysis_date'], '%Y-%m-%d')).days}天前)\n"
            else:
                message += "   上次分析: 从未分析\n"
            
            message += f"   融资阶段: {company.get('funding_stage', 'N/A')}\n"
            message += f"   所在地: {company.get('headquarters', 'N/A')}\n"
            message += "\n"
        
        message += "请回复序号选择要分析的公司，或回复其他公司名称。\n"
        message += "例如：\"1\" 或 \"商汤科技\""
        
        return message

def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='公司名单管理')
    subparsers = parser.add_subparsers(dest='command', help='命令')
    
    # list命令
    list_parser = subparsers.add_parser('list', help='列出所有公司')
    list_parser.add_argument('--filter', choices=['all', 'analyzed', 'unanalyzed'], default='all', help='过滤条件')
    
    # candidates命令
    candidates_parser = subparsers.add_parser('candidates', help='获取候选公司')
    candidates_parser.add_argument('--threshold', type=int, default=365, help='分析阈值天数')
    candidates_parser.add_argument('--max', type=int, default=5, help='最大候选数')
    
    # add命令
    add_parser = subparsers.add_parser('add', help='添加新公司')
    add_parser.add_argument('--name', required=True, help='公司名称')
    add_parser.add_argument('--english', help='英文名称')
    add_parser.add_argument('--business', help='核心业务')
    add_parser.add_argument('--stage', help='融资阶段')
    
    # search命令
    search_parser = subparsers.add_parser('search', help='搜索新公司')
    search_parser.add_argument('--keywords', nargs='+', help='搜索关键词')
    
    # update命令
    update_parser = subparsers.add_parser('update', help='更新分析日期')
    update_parser.add_argument('--name', required=True, help='公司名称')
    update_parser.add_argument('--date', help='分析日期（YYYY-MM-DD）')
    
    args = parser.parse_args()
    
    manager = CompanyManager()
    
    if args.command == 'list':
        companies = manager.companies['companies']
        
        if args.filter == 'analyzed':
            companies = [c for c in companies if c.get('last_analysis_date')]
        elif args.filter == 'unanalyzed':
            companies = [c for c in companies if not c.get('last_analysis_date')]
        
        print(f"总计: {len(companies)} 家公司")
        for company in companies:
            print(f"- {company['name']} ({company.get('english_name', '')})")
            if company.get('last_analysis_date'):
                print(f"  上次分析: {company['last_analysis_date']}")
            else:
                print("  从未分析")
    
    elif args.command == 'candidates':
        candidates = manager.get_candidate_companies(args.threshold, args.max)
        print(f"找到 {len(candidates)} 家候选公司:")
        for company in candidates:
            print(f"- {company['name']}")
            if company.get('last_analysis_date'):
                days = (datetime.now() - datetime.strptime(company['last_analysis_date'], '%Y-%m-%d')).days
                print(f"  上次分析: {company['last_analysis_date']} ({days}天前)")
    
    elif args.command == 'add':
        company_data = {
            'name': args.name,
            'english_name': args.english,
            'core_business': args.business or '',
            'funding_stage': args.stage or '',
            'last_funding_date': datetime.now().strftime('%Y-%m-%d')
        }
        success = manager.add_company(company_data)
        if success:
            print(f"成功添加公司: {args.name}")
        else:
            print(f"公司已存在: {args.name}")
    
    elif args.command == 'search':
        new_companies = manager.search_new_companies(args.keywords)
        print(f"搜索到 {len(new_companies)} 家新公司:")
        for company in new_companies:
            print(f"- {company['name']}: {company['core_business']}")
    
    elif args.command == 'update':
        manager.update_analysis_date(args.name, args.date)
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()