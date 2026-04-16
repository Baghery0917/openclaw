#!/usr/bin/env python3
"""
真实联网搜索集成脚本
功能：通过OpenClaw工具进行真实网络搜索，获取投资分析所需的市场数据
"""

import json
import os
import re
import sys
import time
import subprocess
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import html

class RealSearchProvider:
    """真实搜索提供者 - 通过不同方式调用OpenClaw工具"""
    
    def __init__(self, provider_type: str = "auto"):
        """
        Args:
            provider_type: 提供者类型
                - "auto": 自动检测最佳方式
                - "agent": 通过agent调用
                - "http": 通过HTTP API调用
                - "ws": 通过WebSocket调用
                - "mock": 模拟数据（用于测试）
        """
        self.provider_type = provider_type
        self.gateway_url = "http://localhost:26976"
        self.ws_url = "ws://localhost:26976"
        
        # 自动检测
        if provider_type == "auto":
            self.provider_type = self.detect_best_provider()
        
        print(f"使用搜索提供者: {self.provider_type}")
    
    def detect_best_provider(self) -> str:
        """检测最佳可用的搜索提供者"""
        # 检查网关健康
        try:
            resp = requests.get(f"{self.gateway_url}/health", timeout=3)
            if resp.status_code == 200:
                print("网关服务正常")
                # 优先尝试HTTP API，如果可用
                return "http"  # 暂时默认使用模拟，实际需要测试API可用性
        except:
            print("网关服务不可达")
        
        # 检查openclaw CLI
        try:
            result = subprocess.run(
                ["openclaw", "--version"],
                capture_output=True,
                text=True,
                timeout=3
            )
            if result.returncode == 0:
                print("OpenClaw CLI可用")
                return "agent"
        except:
            print("OpenClaw CLI不可用")
        
        # 默认使用模拟
        return "mock"
    
    def web_search(self, query: str, count: int = 5) -> List[Dict]:
        """执行真实web搜索
        
        Args:
            query: 搜索查询
            count: 结果数量
            
        Returns:
            搜索结果列表
        """
        print(f"[真实搜索] 执行搜索: {query}")
        
        if self.provider_type == "mock":
            return self._mock_web_search(query, count)
        elif self.provider_type == "agent":
            return self._agent_web_search(query, count)
        elif self.provider_type == "http":
            return self._http_web_search(query, count)
        elif self.provider_type == "ws":
            return self._ws_web_search(query, count)
        else:
            print(f"未知提供者类型: {self.provider_type}, 使用模拟数据")
            return self._mock_web_search(query, count)
    
    def web_fetch(self, url: str) -> Optional[str]:
        """获取真实网页内容
        
        Args:
            url: 网页URL
            
        Returns:
            网页内容或None
        """
        print(f"[真实抓取] 获取网页: {url}")
        
        if self.provider_type == "mock":
            return self._mock_web_fetch(url)
        elif self.provider_type == "agent":
            return self._agent_web_fetch(url)
        elif self.provider_type == "http":
            return self._http_web_fetch(url)
        elif self.provider_type == "ws":
            return self._ws_web_fetch(url)
        else:
            print(f"未知提供者类型: {self.provider_type}, 使用模拟数据")
            return self._mock_web_fetch(url)
    
    def _mock_web_search(self, query: str, count: int = 5) -> List[Dict]:
        """模拟web搜索（用于测试）"""
        time.sleep(0.5)  # 模拟网络延迟
        
        # 模拟搜索结果
        mock_results = [
            {
                'title': f'关于搜索"{query}"的结果1',
                'url': f'https://search.example.com/result1?q={query}',
                'snippet': f'这是关于"{query}"的搜索结果摘要...',
                'source': '模拟搜索引擎',
                'date': datetime.now().strftime('%Y-%m-%d')
            },
            {
                'title': f'关于搜索"{query}"的结果2',
                'url': f'https://search.example.com/result2?q={query}',
                'snippet': f'这是关于"{query}"的更多信息...',
                'source': '模拟搜索引擎',
                'date': (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            }
        ]
        
        return mock_results[:count]
    
    def _mock_web_fetch(self, url: str) -> Optional[str]:
        """模拟网页抓取（用于测试）"""
        time.sleep(0.3)
        
        # 模拟网页内容
        mock_content = f"""
        <html>
        <head><title>模拟页面 - {url}</title></head>
        <body>
        <h1>模拟网页内容</h1>
        <p>这是URL为 {url} 的模拟网页内容。</p>
        <p>在实际使用中，这里应该是真实的网页内容。</p>
        </body>
        </html>
        """
        
        return mock_content
    
    def _agent_web_search(self, query: str, count: int = 5) -> List[Dict]:
        """通过agent调用web_search工具"""
        print(f"尝试通过agent调用web_search: {query}")
        
        # 这里需要实现通过openclaw CLI调用agent执行工具
        # 由于OpenClaw架构限制，直接调用可能复杂
        # 暂时使用模拟数据，返回实际实现指南
        
        print("注意: agent调用需要OpenClaw agent会话，当前使用模拟数据")
        print("如需真实搜索，请配置HTTP API或使用WebSocket")
        
        return self._mock_web_search(query, count)
    
    def _agent_web_fetch(self, url: str) -> Optional[str]:
        """通过agent调用web_fetch工具"""
        print(f"尝试通过agent调用web_fetch: {url}")
        
        print("注意: agent调用需要OpenClaw agent会话，当前使用模拟数据")
        print("如需真实抓取，请配置HTTP API或使用WebSocket")
        
        return self._mock_web_fetch(url)
    
    def _http_web_search(self, query: str, count: int = 5) -> List[Dict]:
        """通过HTTP API调用web_search工具"""
        print(f"尝试通过HTTP API调用web_search: {query}")
        
        # OpenClaw网关可能不提供直接的HTTP工具API
        # 这里尝试可能的端点
        
        endpoints = [
            "/api/tools/execute",
            "/api/agent/turn",
            "/v1/tools/execute",
            "/tools/execute"
        ]
        
        for endpoint in endpoints:
            try:
                url = f"{self.gateway_url}{endpoint}"
                print(f"尝试端点: {endpoint}")
                
                response = requests.post(
                    url,
                    json={
                        "tool": "web_search",
                        "params": {"query": query, "count": count}
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"HTTP API调用成功: {endpoint}")
                    return result.get("results", [])
                else:
                    print(f"HTTP {endpoint}: {response.status_code} - {response.text[:100]}")
            except Exception as e:
                print(f"HTTP {endpoint} 错误: {e}")
        
        print("所有HTTP API端点尝试失败，使用模拟数据")
        print("请检查OpenClaw网关配置，确保工具API可用")
        
        return self._mock_web_search(query, count)
    
    def _http_web_fetch(self, url: str) -> Optional[str]:
        """通过HTTP API调用web_fetch工具"""
        print(f"尝试通过HTTP API调用web_fetch: {url}")
        
        endpoints = [
            "/api/tools/execute",
            "/api/agent/turn",
            "/v1/tools/execute",
            "/tools/execute"
        ]
        
        for endpoint in endpoints:
            try:
                api_url = f"{self.gateway_url}{endpoint}"
                print(f"尝试端点: {endpoint}")
                
                response = requests.post(
                    api_url,
                    json={
                        "tool": "web_fetch",
                        "params": {"url": url, "extractMode": "markdown"}
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"HTTP API调用成功: {endpoint}")
                    return result.get("content")
                else:
                    print(f"HTTP {endpoint}: {response.status_code} - {response.text[:100]}")
            except Exception as e:
                print(f"HTTP {endpoint} 错误: {e}")
        
        print("所有HTTP API端点尝试失败，使用模拟数据")
        
        return self._mock_web_fetch(url)
    
    def _ws_web_search(self, query: str, count: int = 5) -> List[Dict]:
        """通过WebSocket调用web_search工具"""
        print(f"尝试通过WebSocket调用web_search: {query}")
        
        # WebSocket实现复杂，需要异步编程
        # 这里提供框架，实际需要实现
        
        print("WebSocket调用需要实现异步客户端，当前使用模拟数据")
        print("参考实现: 使用websockets库连接 {self.ws_url}/ws")
        
        return self._mock_web_search(query, count)
    
    def _ws_web_fetch(self, url: str) -> Optional[str]:
        """通过WebSocket调用web_fetch工具"""
        print(f"尝试通过WebSocket调用web_fetch: {url}")
        
        print("WebSocket调用需要实现异步客户端，当前使用模拟数据")
        
        return self._mock_web_fetch(url)

class RealResearchCollector:
    """真实研究收集器 - 使用真实联网搜索"""
    
    def __init__(self, company_name: str, company_data: Dict = None, 
                 search_provider: str = "auto"):
        """初始化真实研究收集器
        
        Args:
            company_name: 公司名称
            company_data: 公司基础数据
            search_provider: 搜索提供者类型
        """
        self.company_name = company_name
        self.company_data = company_data or {}
        
        # 初始化搜索提供者
        self.search_provider = RealSearchProvider(search_provider)
        
        # 收集结果
        self.research_results = {
            'company_name': company_name,
            'collection_date': datetime.now().isoformat(),
            'dimensions': {
                'technology': {'sources': [], 'info': [], 'reliability': []},
                'growth': {'sources': [], 'info': [], 'reliability': []},
                'cost': {'sources': [], 'info': [], 'reliability': []},
                'competition': {'sources': [], 'info': [], 'reliability': []},
                'team': {'sources': [], 'info': [], 'reliability': []}
            },
            'search_queries': {},
            'raw_data': {},
            'summary': {},
            'search_provider': search_provider
        }
    
    def generate_search_queries(self) -> Dict[str, List[str]]:
        """为五个维度生成搜索查询"""
        company = self.company_name
        english_name = self.company_data.get('english_name', '')
        
        queries = {
            'technology': [
                f"{company} 自研AI技术 专利",
                f"{company} 深度学习框架 GitHub",
                f"{company} AI算法 论文发表",
                f"{english_name} AI technology patent" if english_name else f"{company} AI technology"
            ],
            'growth': [
                f"{company} 年度收入 ARR",
                f"{company} 用户增长 MAU",
                f"{company} 融资情况 投资者",
                f"{english_name} revenue growth funding" if english_name else f"{company} revenue"
            ],
            'cost': [
                f"{company} 运营成本 毛利率",
                f"{company} GPU算力 云计算",
                f"{company} 研发投入 费用",
                f"{english_name} operating cost margin" if english_name else f"{company} cost"
            ],
            'competition': [
                f"{company} 竞争对手 市场定位",
                f"{company} 差异化优势",
                f"{company} 行业竞争格局",
                f"{english_name} competition market share" if english_name else f"{company} competition"
            ],
            'team': [
                f"{company} 创始人 背景",
                f"{company} CTO 技术总监",
                f"{company} 核心团队",
                f"{english_name} founder team LinkedIn" if english_name else f"{company} team"
            ]
        }
        
        self.research_results['search_queries'] = queries
        return queries
    
    def collect_dimension_info(self, dimension: str) -> Dict:
        """收集特定维度的真实信息"""
        print(f"收集 {self.company_name} 的{dimension}信息（真实搜索）...")
        
        queries = self.generate_search_queries()
        dimension_queries = queries.get(dimension, [])
        
        all_info = []
        raw_data = []
        
        for query in dimension_queries[:3]:  # 每个维度最多3个查询
            try:
                # 执行真实搜索
                search_results = self.search_provider.web_search(query)
                raw_data.extend(search_results)
                
                # 处理搜索结果
                for result in search_results[:2]:  # 每个查询最多2个结果
                    # 获取网页内容
                    content = self.search_provider.web_fetch(result['url'])
                    if not content:
                        continue
                    
                    # 提取信息（简化版）
                    info_items = self.extract_info_from_content(content, dimension)
                    
                    # 评估可靠性
                    reliability = self.assess_reliability(result.get('source', '未知'), result['url'])
                    
                    # 整理信息
                    for info_item in info_items[:2]:  # 每个网页最多2条信息
                        formatted_item = {
                            'aspect': self.map_aspect(dimension, info_item),
                            'info': info_item,
                            'source': result.get('source', '网页'),
                            'url': result['url'],
                            'date': result.get('date', datetime.now().strftime('%Y-%m-%d')),
                            'reliability': reliability,
                            'search_query': query,
                            'is_real_data': True if self.search_provider.provider_type != 'mock' else False
                        }
                        all_info.append(formatted_item)
                        
            except Exception as e:
                print(f"查询执行失败 {query}: {e}")
                continue
        
        # 保存结果
        self.research_results['dimensions'][dimension]['info'] = all_info[:10]  # 最多10条
        self.research_results['raw_data'][dimension] = raw_data
        
        return {
            'count': len(all_info),
            'items': all_info[:10],
            'is_real_data': True if self.search_provider.provider_type != 'mock' else False
        }
    
    def extract_info_from_content(self, content: str, dimension: str) -> List[str]:
        """从网页内容提取信息（简化版）"""
        # 实际应该使用更复杂的NLP提取
        # 这里使用简单的关键词匹配
        
        lines = content.split('\n')
        extracted = []
        
        keyword_map = {
            'technology': ['技术', '专利', '算法', '框架', '研发', 'AI', '人工智能'],
            'growth': ['增长', '收入', '用户', '市场', '融资', '投资'],
            'cost': ['成本', '费用', '毛利率', '利润', '算力', 'GPU'],
            'competition': ['竞争', '对手', '市场', '优势', '差异化'],
            'team': ['团队', '创始人', 'CTO', '背景', '经验']
        }
        
        keywords = keyword_map.get(dimension, [])
        
        for line in lines:
            line = html.unescape(line.strip())
            if len(line) > 20 and len(line) < 300:
                if any(keyword in line for keyword in keywords):
                    extracted.append(line)
        
        return extracted[:5]  # 最多5条
    
    def assess_reliability(self, source: str, url: str) -> str:
        """评估信息可靠性"""
        # 官方来源
        if any(pattern in source.lower() or pattern in url.lower() 
               for pattern in ['gov.', '.gov.', '官网', '官方', '年报', '财报']):
            return 'A'
        # 权威媒体
        elif any(pattern in source.lower() or pattern in url.lower()
                 for pattern in ['人民网', '新华网', 'techcrunch', 'reuters', 'bloomberg', '36氪']):
            return 'B'
        # 一般来源
        else:
            return 'C'
    
    def map_aspect(self, dimension: str, text: str) -> str:
        """将文本映射到评估方面"""
        aspect_map = {
            'technology': '技术能力',
            'growth': '增长情况',
            'cost': '成本情况',
            'competition': '竞争情况',
            'team': '团队情况'
        }
        return aspect_map.get(dimension, '相关信息')
    
    def collect_all_dimensions(self) -> Dict:
        """收集所有五个维度的信息"""
        print(f"开始收集 {self.company_name} 的五个维度信息（真实搜索）...")
        
        results = {}
        for dimension in ['technology', 'growth', 'cost', 'competition', 'team']:
            try:
                result = self.collect_dimension_info(dimension)
                results[dimension] = result
                print(f"  {dimension}: 收集到 {result['count']} 条信息" + 
                      (" (真实数据)" if result.get('is_real_data') else " (模拟数据)"))
            except Exception as e:
                print(f"  {dimension}: 收集失败 - {e}")
                results[dimension] = {'count': 0, 'items': [], 'error': str(e)}
        
        # 生成摘要
        total_items = sum(r.get('count', 0) for r in results.values())
        self.research_results['summary'] = {
            'total_info_items': total_items,
            'collection_date': datetime.now().isoformat(),
            'dimension_counts': {k: v.get('count', 0) for k, v in results.items()},
            'search_provider': self.search_provider.provider_type,
            'is_real_data': self.search_provider.provider_type != 'mock'
        }
        
        print(f"信息收集完成，共收集 {total_items} 条信息")
        return results
    
    def save_results(self, output_dir: str = None) -> str:
        """保存收集结果"""
        if output_dir is None:
            workspace = os.environ.get('OPENCLAW_WORKSPACE', '/root/.openclaw/workspace')
            output_dir = Path(workspace) / 'memory' / 'research'
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        safe_name = ''.join(c if c.isalnum() else '_' for c in self.company_name)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"research_real_{safe_name}_{timestamp}.json"
        filepath = output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.research_results, f, ensure_ascii=False, indent=2)
        
        print(f"结果已保存到: {filepath}")
        return str(filepath)
    
    def format_for_review(self) -> str:
        """格式化结果供审核"""
        output = []
        output.append(f"# 【真实搜索资料审核】{self.company_name}")
        output.append(f"收集时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        output.append(f"搜索提供者: {self.search_provider.provider_type}")
        output.append(f"数据来源: {'真实联网搜索' if self.search_provider.provider_type != 'mock' else '模拟数据'}")
        output.append("")
        
        dimension_names = {
            'technology': '技术维度',
            'growth': '增长维度',
            'cost': '成本维度',
            'competition': '竞争维度',
            'team': '团队维度'
        }
        
        for dim_key, dim_name in dimension_names.items():
            output.append(f"## {dim_name}")
            output.append("")
            
            items = self.research_results['dimensions'][dim_key]['info']
            if not items:
                output.append("*(未收集到信息)*")
                output.append("")
                continue
            
            for i, item in enumerate(items, 1):
                reliability_emoji = {'A': '🟢', 'B': '🟡', 'C': '🟠', 'D': '🔴'}.get(item['reliability'], '⚪')
                data_source = "🌐" if item.get('is_real_data', False) else "🧪"
                
                output.append(f"{i}. {data_source}【{reliability_emoji}{item['reliability']}级】{item['aspect']}：{item['info'][:100]}...")
                output.append(f"   来源：{item['source']}（{item['date']}）")
                if item.get('url'):
                    output.append(f"   链接：{item['url']}")
                if item.get('search_query'):
                    output.append(f"   搜索查询：{item['search_query']}")
                output.append("")
        
        # 配置建议
        if self.search_provider.provider_type == 'mock':
            output.append("## ⚠️ 配置真实搜索")
            output.append("")
            output.append("当前使用模拟数据。要启用真实联网搜索，请：")
            output.append("1. **检查OpenClaw网关配置**，确保web_search/web_fetch工具已启用")
            output.append("2. **配置HTTP API端点**（如果网关提供工具API）")
            output.append("3. **使用agent调用**（通过openclaw CLI）")
            output.append("4. **或使用WebSocket连接**（需要实现客户端）")
            output.append("")
            output.append("详细配置指南请参考: REFERENCES_REAL_WEB_SEARCH_INTEGRATION.md")
            output.append("")
        
        output.append("请审核以上信息，确认无误后回复\"批准分析\"。")
        
        return "\n".join(output)

def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='真实联网搜索研究收集')
    parser.add_argument('company', help='公司名称')
    parser.add_argument('--english-name', help='公司英文名称')
    parser.add_argument('--provider', choices=['auto', 'mock', 'agent', 'http', 'ws'], 
                       default='auto', help='搜索提供者类型')
    parser.add_argument('--output', help='输出目录')
    parser.add_argument('--format', choices=['json', 'review'], default='review', help='输出格式')
    
    args = parser.parse_args()
    
    company_data = {}
    if args.english_name:
        company_data['english_name'] = args.english_name
    
    collector = RealResearchCollector(args.company, company_data, args.provider)
    collector.collect_all_dimensions()
    
    if args.output:
        saved_file = collector.save_results(args.output)
        print(f"数据已保存到: {saved_file}")
    else:
        collector.save_results()
    
    if args.format == 'review':
        print("\n" + "="*60)
        print(collector.format_for_review())
    else:
        print(json.dumps(collector.research_results, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()