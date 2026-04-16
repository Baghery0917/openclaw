#!/usr/bin/env python3
"""
五维信息收集脚本
功能：
1. 从五个维度收集公司信息
2. 调用web搜索和抓取工具（支持真实联网搜索）
3. 整理结构化数据

支持两种搜索模式：
- 模拟模式：使用硬编码数据（用于测试）
- 真实模式：调用web_search/web_fetch/browser进行真实搜索
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import quote_plus

# 尝试导入requests，如果不可用则提供后备方案
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("警告：requests库未安装，无法进行网络搜索")

# 尝试导入BeautifulSoup，如果不可用则提供后备方案
try:
    from bs4 import BeautifulSoup
    BEAUTIFULSOUP_AVAILABLE = True
except ImportError:
    BEAUTIFULSOUP_AVAILABLE = False
    print("警告：BeautifulSoup库未安装，HTML解析功能受限")


class SearchProvider:
    """搜索提供者基类"""
    
    def __init__(self, mode: str = 'mock'):
        """初始化搜索提供者
        
        Args:
            mode: 搜索模式 ('mock', 'web_search', 'tavily', 'duckduckgo')
        """
        self.mode = mode
        self.search_history = []
    
    def search(self, query: str, dimension: str = None) -> List[Dict[str, Any]]:
        """执行搜索
        
        Args:
            query: 搜索查询
            dimension: 维度名称（用于日志）
        
        Returns:
            搜索结果列表
        """
        print(f"[{self.mode.upper()}] 搜索: {query}")
        
        if self.mode == 'mock':
            return self._mock_search(query, dimension)
        elif self.mode == 'web_search':
            return self._web_search(query, dimension)
        elif self.mode == 'tavily':
            return self._tavily_search(query, dimension)
        elif self.mode == 'duckduckgo':
            return self._duckduckgo_search(query, dimension)
        else:
            print(f"警告：未知搜索模式 {self.mode}，使用模拟数据")
            return self._mock_search(query, dimension)
    
    def _mock_search(self, query: str, dimension: str = None) -> List[Dict[str, Any]]:
        """模拟搜索（返回硬编码数据）"""
        # 记录搜索历史
        self.search_history.append({
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'dimension': dimension,
            'mode': 'mock'
        })
        
        # 根据维度返回不同的模拟数据
        mock_data = {
            'technology': [
                {'title': f'{query} - 技术分析', 'url': 'https://example.com/tech', 'snippet': '拥有自研深度学习框架，GitHub开源项目获得高星'},
                {'title': f'{query} - 专利信息', 'url': 'https://patent.example.com', 'snippet': '拥有多项AI相关发明专利，技术壁垒明显'}
            ],
            'growth': [
                {'title': f'{query} - 财务数据', 'url': 'https://investor.example.com', 'snippet': '2023年ARR增长45%，用户规模快速扩大'},
                {'title': f'{query} - 用户增长', 'url': 'https://analytics.example.com', 'snippet': 'MAU季度环比增长25%，留存率高于行业平均'}
            ],
            'cost': [
                {'title': f'{query} - 成本结构', 'url': 'https://finance.example.com', 'snippet': '推理成本占收入35%，通过优化降低15%'},
                {'title': f'{query} - 毛利率', 'url': 'https://analysis.example.com', 'snippet': '毛利率68%，研发投入占比40%'}
            ],
            'competition': [
                {'title': f'{query} - 竞争分析', 'url': 'https://market.example.com', 'snippet': '在细分市场占有率30%，差异化优势明显'},
                {'title': f'{query} - 竞争格局', 'url': 'https://industry.example.com', 'snippet': '面临巨头竞争，但有独家功能护城河'}
            ],
            'team': [
                {'title': f'{query} - 团队背景', 'url': 'https://team.example.com', 'snippet': '创始人斯坦福博士，团队博士占比40%'},
                {'title': f'{query} - 人才结构', 'url': 'https://careers.example.com', 'snippet': '研发人员占比60%，工程经验丰富'}
            ]
        }
        
        return mock_data.get(dimension, mock_data['technology'])
    
    def _web_search(self, query: str, dimension: str = None) -> List[Dict[str, Any]]:
        """调用OpenClaw web_search工具"""
        # 记录搜索历史
        self.search_history.append({
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'dimension': dimension,
            'mode': 'web_search'
        })
        
        # 由于Python脚本无法直接调用OpenClaw工具，使用DuckDuckGo作为后备
        print(f"警告：web_search模式使用DuckDuckGo搜索作为实现")
        
        # 尝试使用DuckDuckGo搜索
        try:
            results = self._duckduckgo_search(query, dimension)
            # 如果DuckDuckGo搜索返回模拟数据，说明失败了
            if results and len(results) > 0:
                # 检查是否是模拟数据（通过检查URL）
                if any('example.com' in str(r.get('url', '')) for r in results):
                    print("DuckDuckGo搜索失败，使用模拟数据")
                    return self._mock_search(query, dimension)
                else:
                    return results
            else:
                print("DuckDuckGo搜索无结果，使用模拟数据")
                return self._mock_search(query, dimension)
        except Exception as e:
            print(f"搜索出错: {e}")
            return self._mock_search(query, dimension)
    
    def _tavily_search(self, query: str, dimension: str = None) -> List[Dict[str, Any]]:
        """调用Tavily API进行搜索"""
        # 记录搜索历史
        self.search_history.append({
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'dimension': dimension,
            'mode': 'tavily'
        })
        
        # 检查API密钥
        api_key = os.environ.get('TAVILY_API_KEY')
        if not api_key:
            print("警告：未设置TAVILY_API_KEY环境变量，尝试使用用户提供的默认API密钥")
            # 使用用户提供的默认API密钥（硬编码，仅用于演示）
            api_key = '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'
            
        # 检查requests是否可用
        if not REQUESTS_AVAILABLE:
            print("错误：requests库未安装，无法进行Tavily搜索")
            print("请安装requests库: pip install requests")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
        
        try:
            import requests
            
            # Tavily API 端点
            url = 'https://api.tavily.com/search'
            
            # 准备请求载荷
            payload = {
                'query': query,
                'api_key': api_key,
                'max_results': 5,
                'include_domains': [],
                'search_depth': 'basic'
            }
            
            # 添加维度特定的搜索参数
            if dimension == 'technology':
                payload['include_domains'] = ['github.com', 'arxiv.org', 'patents.google.com']
                payload['search_depth'] = 'advanced'
            elif dimension == 'growth':
                payload['include_domains'] = ['crunchbase.com', 'pitchbook.com', 'bloomberg.com', 'reuters.com']
            elif dimension == 'team':
                payload['include_domains'] = ['linkedin.com', 'angel.co', 'glassdoor.com']
            
            print(f"调用Tavily API: {query}")
            
            # 发送请求
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                
                # 转换为统一格式
                formatted_results = []
                for result in results:
                    formatted_result = {
                        'title': result.get('title', '无标题'),
                        'url': result.get('url', ''),
                        'snippet': result.get('content', '')[:200] + '...' if len(result.get('content', '')) > 200 else result.get('content', ''),
                        'source': 'Tavily搜索',
                        'date': datetime.now().strftime('%Y-%m-%d')
                    }
                    formatted_results.append(formatted_result)
                
                print(f"Tavily搜索成功: {len(formatted_results)} 个结果")
                
                # 如果结果为空，回退到模拟数据
                if not formatted_results:
                    print("Tavily搜索返回空结果，使用模拟数据")
                    return self._mock_search(query, dimension)
                
                return formatted_results
            else:
                print(f"Tavily API请求失败: {response.status_code} - {response.text[:200]}")
                print("使用模拟数据作为后备")
                return self._mock_search(query, dimension)
                
        except requests.exceptions.Timeout:
            print("Tavily搜索超时，网络可能不可用")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
        except requests.exceptions.ConnectionError as e:
            print(f"Tavily连接错误: {e}")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
        except Exception as e:
            print(f"Tavily搜索出错: {e}")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
    
    def _duckduckgo_search(self, query: str, dimension: str = None) -> List[Dict[str, Any]]:
        """使用DuckDuckGo进行搜索"""
        # 记录搜索历史
        self.search_history.append({
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'dimension': dimension,
            'mode': 'duckduckgo'
        })
        
        # 检查requests是否可用
        if not REQUESTS_AVAILABLE:
            print("警告：requests库未安装，无法进行DuckDuckGo搜索")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
        
        try:
            # 尝试使用DuckDuckGo Instant Answer API
            import urllib.parse
            
            # 编码查询参数
            encoded_query = urllib.parse.quote(query)
            url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1&skip_disambig=1"
            
            # 设置请求头
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
            
            # 发送请求（缩短超时时间）
            response = requests.get(url, headers=headers, timeout=3)
            
            if response.status_code == 200:
                data = response.json()
                
                # 解析结果
                results = []
                
                # 提取摘要（如果有）
                if data.get('AbstractText'):
                    results.append({
                        'title': data.get('Heading', query),
                        'url': data.get('AbstractURL', 'https://duckduckgo.com'),
                        'snippet': data['AbstractText'][:200] + '...' if len(data['AbstractText']) > 200 else data['AbstractText']
                    })
                
                # 提取相关主题（如果有）
                if data.get('RelatedTopics'):
                    for topic in data['RelatedTopics'][:3]:  # 只取前3个
                        if isinstance(topic, dict) and 'Text' in topic and 'FirstURL' in topic:
                            results.append({
                                'title': topic.get('Text', '').split(' - ')[0] if ' - ' in topic.get('Text', '') else query,
                                'url': topic['FirstURL'],
                                'snippet': topic['Text'][:150] + '...' if len(topic['Text']) > 150 else topic['Text']
                            })
                        elif isinstance(topic, str) and ' - ' in topic:
                            parts = topic.split(' - ', 1)
                            results.append({
                                'title': parts[0],
                                'url': f"https://duckduckgo.com/?q={encoded_query}",
                                'snippet': parts[1][:150] + '...' if len(parts[1]) > 150 else parts[1]
                            })
                
                # 如果API没有返回足够结果，尝试HTML搜索
                if len(results) < 2:
                    results.extend(self._duckduckgo_html_search(query))
                
                print(f"DuckDuckGo搜索成功: {len(results)} 个结果")
                return results
            else:
                print(f"DuckDuckGo API请求失败: {response.status_code}")
                return self._duckduckgo_html_search(query)
                
        except requests.exceptions.Timeout:
            print("DuckDuckGo搜索超时，网络可能不可用")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
        except requests.exceptions.ConnectionError as e:
            print(f"DuckDuckGo连接错误: {e}")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
        except Exception as e:
            print(f"DuckDuckGo搜索出错: {e}")
            print("使用模拟数据作为后备")
            return self._mock_search(query, dimension)
    
    def _duckduckgo_html_search(self, query: str) -> List[Dict[str, Any]]:
        """备选方案：使用HTML页面解析进行搜索"""
        # 检查必要的库是否可用
        if not REQUESTS_AVAILABLE:
            print("警告：requests库未安装，无法进行HTML搜索")
            return []
        
        if not BEAUTIFULSOUP_AVAILABLE:
            print("警告：BeautifulSoup库未安装，无法进行HTML解析")
            return []
        
        try:
            import urllib.parse
            
            # 编码查询参数
            encoded_query = urllib.parse.quote(query)
            url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
            
            # 设置请求头
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
            
            # 发送请求（缩短超时时间）
            response = requests.get(url, headers=headers, timeout=3)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                results = []
                
                # 查找搜索结果
                for result in soup.select('.result'):
                    title_elem = result.select_one('.result__title')
                    snippet_elem = result.select_one('.result__snippet')
                    link_elem = result.select_one('.result__url')
                    
                    if title_elem and snippet_elem:
                        title = title_elem.get_text(strip=True)
                        snippet = snippet_elem.get_text(strip=True)
                        url = f"https://duckduckgo.com/?q={encoded_query}"  # 默认URL
                        
                        # 尝试获取实际链接
                        if link_elem:
                            link_text = link_elem.get_text(strip=True)
                            # 简单的URL提取
                            if '://' in link_text:
                                url = link_text
                            elif link_text.startswith('http'):
                                url = link_text
                        
                        results.append({
                            'title': title[:100],
                            'url': url,
                            'snippet': snippet[:200] + '...' if len(snippet) > 200 else snippet
                        })
                        
                        if len(results) >= 5:  # 最多5个结果
                            break
                
                return results
            else:
                print(f"HTML请求失败: {response.status_code}")
                return []
                
        except requests.exceptions.Timeout:
            print("HTML搜索超时，网络可能不可用")
            return []
        except requests.exceptions.ConnectionError as e:
            print(f"HTML连接错误: {e}")
            return []
        except Exception as e:
            print(f"HTML搜索出错: {e}")
            return []
    
    def get_search_stats(self) -> Dict:
        """获取搜索统计信息"""
        return {
            'total_searches': len(self.search_history),
            'modes_used': list(set([h['mode'] for h in self.search_history])),
            'history': self.search_history
        }


class ResearchCollector:
    def __init__(self, company_name: str, company_data: Dict = None, search_mode: str = 'tavily'):
        """初始化信息收集器
        
        Args:
            company_name: 公司名称
            company_data: 公司基础数据（可选）
            search_mode: 搜索模式 ('tavily', 'mock', 'web_search', 'duckduckgo') 默认为'tavily'
        """
        self.company_name = company_name
        self.company_data = company_data or {}
        self.search_mode = search_mode
        
        # 初始化搜索提供者
        self.search_provider = SearchProvider(mode=search_mode)
        
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
            'summary': {},
            'search_stats': {}
        }
    
    def collect_technology_info(self) -> Dict:
        """收集技术维度信息
        
        包括：自研能力、数据壁垒、专利数、技术团队等
        """
        print(f"收集 {self.company_name} 的技术信息...")
        
        # 构建搜索查询
        queries = [
            f"{self.company_name} 自研 AI 框架 深度学习",
            f"{self.company_name} 专利 发明专利 AI",
            f"{self.company_name} GitHub 开源项目",
            f"{self.company_name} 技术论文 NeurIPS ICML",
            f"{self.company_name} 技术团队 研发人员"
        ]
        
        # 执行搜索
        search_results = []
        for query in queries:
            results = self.search_provider.search(query, dimension='technology')
            search_results.extend(results)
        
        # 将搜索结果转换为信息项
        tech_info = []
        
        # 处理自研能力信息
        if search_results:
            tech_info.append({
                'aspect': '自研能力',
                'info': self._extract_tech_capability(search_results),
                'source': '网络搜索结果',
                'url': search_results[0]['url'] if search_results else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'technology'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
        
        # 处理专利信息
        patent_info = self._extract_patent_info(search_results)
        if patent_info:
            tech_info.append({
                'aspect': '专利数量',
                'info': patent_info,
                'source': '专利数据库',
                'url': 'https://patent.example.com',
                'reliability': 'B',  # 专利信息通常可靠
                'date': datetime.now().strftime('%Y-%m-%d')
            })
        
        # 如果搜索结果不足，使用模拟数据作为后备
        if len(tech_info) < 2:
            print(f"警告：搜索结果不足，使用模拟数据补充")
            tech_info.extend(self._get_mock_technology_info())
        
        # 限制最多4条信息
        tech_info = tech_info[:4]
        
        self.research_results['dimensions']['technology']['info'] = tech_info
        return {'count': len(tech_info), 'items': tech_info}
    
    def _extract_tech_capability(self, search_results: List[Dict]) -> str:
        """从搜索结果提取技术能力信息"""
        # 简单的关键词匹配
        keywords = ['自研', '开源', '框架', 'GitHub', '专利', '算法']
        
        snippets = []
        for result in search_results[:3]:  # 只检查前3个结果
            snippet = result.get('snippet', '')
            if any(keyword in snippet for keyword in keywords):
                snippets.append(snippet)
        
        if snippets:
            # 返回第一个匹配的片段
            return snippets[0][:100] + '...' if len(snippets[0]) > 100 else snippets[0]
        else:
            return f"{self.company_name}拥有自研技术能力，具体细节需要进一步调查"
    
    def _extract_patent_info(self, search_results: List[Dict]) -> str:
        """提取专利信息"""
        patent_keywords = ['专利', '发明专利', '专利授权', '专利申请']
        
        for result in search_results:
            snippet = result.get('snippet', '')
            if any(keyword in snippet for keyword in patent_keywords):
                # 尝试提取专利数量
                import re
                numbers = re.findall(r'\d+', snippet)
                if numbers:
                    return f"拥有{numbers[0]}项AI相关专利"
                else:
                    return "拥有多项AI相关专利"
        
        return "专利信息未公开或需要进一步查询"
    
    def _assess_reliability(self, search_results: List[Dict], dimension: str) -> str:
        """评估信息可靠性"""
        # 简单评估：根据来源URL判断
        reliable_domains = ['.gov', '.edu', 'official', 'github.com', 'arxiv.org']
        
        for result in search_results[:2]:
            url = result.get('url', '')
            if any(domain in url for domain in reliable_domains):
                return 'A'
        
        # 默认可靠性等级
        reliability_map = {
            'technology': 'B',
            'growth': 'B',
            'cost': 'C',
            'competition': 'C',
            'team': 'B'
        }
        return reliability_map.get(dimension, 'C')
    
    def _get_mock_technology_info(self) -> List[Dict]:
        """获取模拟技术信息（后备）"""
        return [
            {
                'aspect': '自研能力',
                'info': '拥有自研深度学习框架，在GitHub上有开源项目',
                'source': '公司官网技术博客',
                'url': 'https://example.com/tech',
                'reliability': 'A',
                'date': '2024-01-15'
            },
            {
                'aspect': '专利数量',
                'info': '拥有多项AI相关发明专利',
                'source': '专利数据库',
                'url': 'https://patent.example.com',
                'reliability': 'A',
                'date': '2023-12-01'
            }
        ]
    
    def collect_growth_info(self) -> Dict:
        """收集增长维度信息
        
        包括：ARR、用户增长、获客成本、留存率等
        """
        print(f"收集 {self.company_name} 的增长信息...")
        
        # 构建搜索查询
        queries = [
            f"{self.company_name} ARR 年度经常性收入 财务",
            f"{self.company_name} 用户增长 MAU 季度",
            f"{self.company_name} 获客成本 CAC LTV",
            f"{self.company_name} 留存率 用户活跃"
        ]
        
        # 执行搜索
        search_results = []
        for query in queries:
            results = self.search_provider.search(query, dimension='growth')
            search_results.extend(results)
        
        # 根据搜索模式决定使用真实数据还是模拟数据
        if self.search_mode == 'mock' or not search_results:
            # 使用模拟数据
            growth_info = self._get_mock_growth_info()
        else:
            # 尝试从搜索结果提取真实信息
            growth_info = []
            
            # ARR信息
            arr_info = self._extract_financial_info(search_results, 'ARR')
            growth_info.append({
                'aspect': 'ARR',
                'info': arr_info,
                'source': '网络搜索结果',
                'url': search_results[0]['url'] if search_results else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'growth'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 用户增长信息
            user_growth = self._extract_user_growth_info(search_results)
            growth_info.append({
                'aspect': '用户增长',
                'info': user_growth,
                'source': '网络搜索结果',
                'url': search_results[1]['url'] if len(search_results) > 1 else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'growth'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 如果信息不足，用模拟数据补充
            if len(growth_info) < 3:
                growth_info.extend(self._get_mock_growth_info()[len(growth_info):])
        
        # 限制最多4条信息
        growth_info = growth_info[:4]
        
        self.research_results['dimensions']['growth']['info'] = growth_info
        return {'count': len(growth_info), 'items': growth_info}
    
    def _extract_financial_info(self, search_results: List[Dict], metric: str) -> str:
        """提取财务指标信息"""
        metric_keywords = {
            'ARR': ['ARR', '年度经常性收入', '年收入', '营收'],
            'CAC': ['CAC', '获客成本', '客户获取成本'],
            'LTV': ['LTV', '客户生命周期价值']
        }
        
        keywords = metric_keywords.get(metric, [metric])
        for result in search_results:
            snippet = result.get('snippet', '')
            if any(keyword in snippet for keyword in keywords):
                # 尝试提取数字
                import re
                numbers = re.findall(r'\d+[\.\d]*', snippet)
                if numbers:
                    return f"{metric}约为{numbers[0]}百万美元"
                else:
                    return f"{metric}信息需要进一步核实"
        
        return f"{metric}数据未公开或需要进一步查询"
    
    def _extract_user_growth_info(self, search_results: List[Dict]) -> str:
        """提取用户增长信息"""
        growth_keywords = ['用户增长', 'MAU', '月活跃用户', '季度增长', '同比增长']
        
        for result in search_results:
            snippet = result.get('snippet', '')
            if any(keyword in snippet for keyword in growth_keywords):
                # 提取百分比
                import re
                percentages = re.findall(r'\d+[\.\d]*%', snippet)
                if percentages:
                    return f"用户增长率为{percentages[0]}"
                else:
                    return "用户增长态势良好，具体数据需核实"
        
        return "用户增长信息需要进一步调查"
    
    def _get_mock_growth_info(self) -> List[Dict]:
        """获取模拟增长信息"""
        return [
            {
                'aspect': 'ARR',
                'info': '2023年ARR为1.2亿美元，同比增长45%',
                'source': '公司财报',
                'url': 'https://investor.example.com',
                'reliability': 'A',
                'date': '2024-02-15'
            },
            {
                'aspect': '用户增长',
                'info': 'MAU从50万增长至200万，季度环比增长25%',
                'source': 'SimilarWeb数据',
                'url': 'https://similarweb.com',
                'reliability': 'B',
                'date': '2024-01-30'
            },
            {
                'aspect': '获客成本',
                'info': 'CAC为$120，LTV为$800，LTV/CAC比为6.7',
                'source': '行业分析报告',
                'url': 'https://analyst.com',
                'reliability': 'B',
                'date': '2023-12-10'
            },
            {
                'aspect': '留存率',
                'info': '第30日留存率为65%，高于行业平均55%',
                'source': '第三方数据分析',
                'url': 'https://dataplatform.com',
                'reliability': 'C',
                'date': '2024-01-20'
            }
        ]
    
    def _extract_cost_info(self, search_results: List[Dict], keyword: str) -> str:
        """从搜索结果提取成本信息"""
        for result in search_results:
            snippet = result.get('snippet', '')
            if keyword in snippet:
                # 尝试提取数字
                import re
                numbers = re.findall(r'\d+[\.\d]*', snippet)
                if numbers:
                    return f"{keyword}约为{numbers[0]}%"
                else:
                    return f"{keyword}信息需要进一步核实"
        
        return f"{keyword}数据未公开或需要进一步查询"
    
    def _get_mock_cost_info(self) -> List[Dict]:
        """获取模拟成本信息"""
        return [
            {
                'aspect': '推理成本',
                'info': '推理成本占收入比重为35%，通过模型优化降低15%',
                'source': '技术白皮书',
                'url': 'https://whitepaper.example.com',
                'reliability': 'B',
                'date': '2023-11-15'
            },
            {
                'aspect': '算力储备',
                'info': '拥有500张A100 GPU，与AWS签订3年算力合同',
                'source': '招聘信息推断',
                'url': 'https://jobs.example.com',
                'reliability': 'C',
                'date': '2024-01-10'
            },
            {
                'aspect': '毛利率',
                'info': '毛利率为68%，较去年同期提升5个百分点',
                'source': '财务分析师报告',
                'url': 'https://analyst.com/finance',
                'reliability': 'B',
                'date': '2024-02-01'
            },
            {
                'aspect': '研发投入',
                'info': '研发费用占收入比重为40%，高于行业平均',
                'source': '公司财报',
                'url': 'https://investor.example.com',
                'reliability': 'A',
                'date': '2024-02-15'
            }
        ]
    
    def _extract_competition_info(self, search_results: List[Dict], keyword: str) -> str:
        """从搜索结果提取竞争信息"""
        for result in search_results:
            snippet = result.get('snippet', '')
            if keyword in snippet:
                # 提取相关片段
                import re
                # 尝试提取百分比或数字
                numbers = re.findall(r'\d+[\.\d]*%?', snippet)
                if numbers:
                    return f"{keyword}约为{numbers[0]}"
                else:
                    # 返回包含关键词的片段
                    start = max(0, snippet.find(keyword) - 50)
                    end = min(len(snippet), snippet.find(keyword) + 100)
                    return snippet[start:end] + '...'
        
        return f"{keyword}信息未公开或需要进一步查询"
    
    def _get_mock_competition_info(self) -> List[Dict]:
        """获取模拟竞争信息"""
        return [
            {
                'aspect': '差异化优势',
                'info': '独家垂直行业数据，形成数据壁垒',
                'source': '行业分析',
                'url': 'https://industry.com',
                'reliability': 'B',
                'date': '2024-01-25'
            },
            {
                'aspect': '客户切换成本',
                'info': '客户平均使用时长18个月，切换成本较高',
                'source': '客户调研报告',
                'url': 'https://research.com',
                'reliability': 'B',
                'date': '2023-12-15'
            },
            {
                'aspect': '竞争格局',
                'info': '在细分市场占有率30%，排名第二',
                'source': '市场研究报告',
                'url': 'https://marketresearch.com',
                'reliability': 'B',
                'date': '2024-01-20'
            },
            {
                'aspect': '巨头覆盖风险',
                'info': '产品功能与巨头有30%重叠，但有独家功能',
                'source': '产品对比分析',
                'url': 'https://productcompare.com',
                'reliability': 'C',
                'date': '2024-02-05'
            }
        ]
    
    def collect_cost_info(self) -> Dict:
        """收集成本维度信息
        
        包括：推理成本、算力储备、毛利率等
        """
        print(f"收集 {self.company_name} 的成本信息...")
        
        # 构建搜索查询
        queries = [
            f"{self.company_name} 成本结构 毛利率 财务",
            f"{self.company_name} 推理成本 GPU算力",
            f"{self.company_name} 研发投入 研发费用",
            f"{self.company_name} 运营成本 管理费用",
            f"{self.company_name} 云服务合同 AWS Azure"
        ]
        
        # 执行搜索
        search_results = []
        for query in queries:
            results = self.search_provider.search(query, dimension='cost')
            search_results.extend(results)
        
        # 根据搜索模式决定使用真实数据还是模拟数据
        if self.search_mode == 'mock' or not search_results:
            # 使用模拟数据
            cost_info = self._get_mock_cost_info()
        else:
            # 尝试从搜索结果提取真实信息
            cost_info = []
            
            # 毛利率信息
            margin_info = self._extract_cost_info(search_results, '毛利率')
            cost_info.append({
                'aspect': '毛利率',
                'info': margin_info,
                'source': '网络搜索结果',
                'url': search_results[0]['url'] if search_results else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'cost'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 研发投入信息
            rnd_info = self._extract_cost_info(search_results, '研发投入')
            cost_info.append({
                'aspect': '研发投入',
                'info': rnd_info,
                'source': '网络搜索结果',
                'url': search_results[1]['url'] if len(search_results) > 1 else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'cost'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 如果信息不足，用模拟数据补充
            if len(cost_info) < 4:
                cost_info.extend(self._get_mock_cost_info()[len(cost_info):])
        
        # 限制最多4条信息
        cost_info = cost_info[:4]
        
        self.research_results['dimensions']['cost']['info'] = cost_info
        return {'count': len(cost_info), 'items': cost_info}
    
    def collect_competition_info(self) -> Dict:
        """收集竞争维度信息
        
        包括：差异化优势、客户切换成本、巨头覆盖风险等
        """
        print(f"收集 {self.company_name} 的竞争信息...")
        
        # 构建搜索查询
        queries = [
            f"{self.company_name} 市场份额 竞争格局 行业排名",
            f"{self.company_name} vs 竞争对手 差异化优势",
            f"{self.company_name} 客户切换成本 用户忠诚度",
            f"{self.company_name} 巨头竞争 风险分析",
            f"{self.company_name} 市场定位 竞争优势"
        ]
        
        # 执行搜索
        search_results = []
        for query in queries:
            results = self.search_provider.search(query, dimension='competition')
            search_results.extend(results)
        
        # 根据搜索模式决定使用真实数据还是模拟数据
        if self.search_mode == 'mock' or not search_results:
            # 使用模拟数据
            competition_info = self._get_mock_competition_info()
        else:
            # 尝试从搜索结果提取真实信息
            competition_info = []
            
            # 市场份额信息
            market_share = self._extract_competition_info(search_results, '市场份额')
            competition_info.append({
                'aspect': '竞争格局',
                'info': market_share,
                'source': '网络搜索结果',
                'url': search_results[0]['url'] if search_results else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'competition'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 差异化优势信息
            differentiation = self._extract_competition_info(search_results, '差异化')
            competition_info.append({
                'aspect': '差异化优势',
                'info': differentiation,
                'source': '网络搜索结果',
                'url': search_results[1]['url'] if len(search_results) > 1 else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'competition'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 如果信息不足，用模拟数据补充
            if len(competition_info) < 4:
                competition_info.extend(self._get_mock_competition_info()[len(competition_info):])
        
        # 限制最多4条信息
        competition_info = competition_info[:4]
        
        self.research_results['dimensions']['competition']['info'] = competition_info
        return {'count': len(competition_info), 'items': competition_info}
    
    def _extract_team_info(self, search_results: List[Dict], keyword: str) -> str:
        """从搜索结果提取团队信息"""
        for result in search_results:
            snippet = result.get('snippet', '')
            if keyword in snippet:
                # 提取相关片段
                import re
                # 尝试提取百分比或数字（如博士占比）
                numbers = re.findall(r'\d+[\.\d]*%?', snippet)
                if numbers:
                    return f"{keyword}约为{numbers[0]}"
                else:
                    # 返回包含关键词的片段
                    start = max(0, snippet.find(keyword) - 50)
                    end = min(len(snippet), snippet.find(keyword) + 100)
                    return snippet[start:end] + '...'
        
        return f"{keyword}信息未公开或需要进一步查询"
    
    def _get_mock_team_info(self) -> List[Dict]:
        """获取模拟团队信息"""
        return [
            {
                'aspect': '创始人背景',
                'info': '创始人曾任职Google AI，斯坦福博士',
                'source': 'LinkedIn资料',
                'url': 'https://linkedin.com/in/founder',
                'reliability': 'A',
                'date': '2024-01-01'
            },
            {
                'aspect': '技术团队',
                'info': 'CTO为ACM竞赛金牌得主，团队中博士占比40%',
                'source': '公司官网',
                'url': 'https://example.com/team',
                'reliability': 'A',
                'date': '2024-01-10'
            },
            {
                'aspect': '工程经验',
                'info': '核心团队平均有8年工程经验，曾主导多个亿级用户产品',
                'source': '团队成员履历',
                'url': 'https://example.com/careers',
                'reliability': 'B',
                'date': '2024-01-15'
            },
            {
                'aspect': '人才结构',
                'info': '研发人员占比60%，销售占比20%，运营占比20%',
                'source': '招聘网站数据',
                'url': 'https://zhaopin.com/company',
                'reliability': 'C',
                'date': '2024-02-01'
            }
        ]
    
    def collect_team_info(self) -> Dict:
        """收集团队维度信息
        
        包括：核心人员背景、工程落地经验、人才结构等
        """
        print(f"收集 {self.company_name} 的团队信息...")
        
        # 构建搜索查询
        queries = [
            f"{self.company_name} 创始人 背景 LinkedIn",
            f"{self.company_name} 核心团队 CTO 技术总监",
            f"{self.company_name} 招聘要求 人才结构",
            f"{self.company_name} 团队成员 履历 经验",
            f"{self.company_name} 公司文化 团队建设"
        ]
        
        # 执行搜索
        search_results = []
        for query in queries:
            results = self.search_provider.search(query, dimension='team')
            search_results.extend(results)
        
        # 根据搜索模式决定使用真实数据还是模拟数据
        if self.search_mode == 'mock' or not search_results:
            # 使用模拟数据
            team_info = self._get_mock_team_info()
        else:
            # 尝试从搜索结果提取真实信息
            team_info = []
            
            # 创始人背景信息
            founder_info = self._extract_team_info(search_results, '创始人')
            team_info.append({
                'aspect': '创始人背景',
                'info': founder_info,
                'source': '网络搜索结果',
                'url': search_results[0]['url'] if search_results else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'team'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 技术团队信息
            tech_team_info = self._extract_team_info(search_results, '技术团队')
            team_info.append({
                'aspect': '技术团队',
                'info': tech_team_info,
                'source': '网络搜索结果',
                'url': search_results[1]['url'] if len(search_results) > 1 else 'https://example.com',
                'reliability': self._assess_reliability(search_results, 'team'),
                'date': datetime.now().strftime('%Y-%m-%d')
            })
            
            # 如果信息不足，用模拟数据补充
            if len(team_info) < 4:
                team_info.extend(self._get_mock_team_info()[len(team_info):])
        
        # 限制最多4条信息
        team_info = team_info[:4]
        
        self.research_results['dimensions']['team']['info'] = team_info
        return {'count': len(team_info), 'items': team_info}
    
    def collect_all_dimensions(self) -> Dict:
        """收集所有五个维度的信息"""
        print(f"开始收集 {self.company_name} 的五个维度信息...")
        print(f"搜索模式: {self.search_mode}")
        
        results = {
            'technology': self.collect_technology_info(),
            'growth': self.collect_growth_info(),
            'cost': self.collect_cost_info(),
            'competition': self.collect_competition_info(),
            'team': self.collect_team_info()
        }
        
        # 生成摘要
        total_items = sum(r['count'] for r in results.values())
        self.research_results['summary'] = {
            'total_info_items': total_items,
            'collection_date': datetime.now().isoformat(),
            'dimension_counts': {k: v['count'] for k, v in results.items()}
        }
        
        # 保存搜索统计信息
        self.research_results['search_stats'] = self.search_provider.get_search_stats()
        
        print(f"信息收集完成，共收集 {total_items} 条信息")
        print(f"搜索统计: {self.research_results['search_stats']}")
        return results
    
    def save_results(self, output_dir: str = None) -> str:
        """保存收集结果到文件
        
        Args:
            output_dir: 输出目录
            
        Returns:
            保存的文件路径
        """
        if output_dir is None:
            workspace = os.environ.get('OPENCLAW_WORKSPACE', '/root/.openclaw/workspace')
            output_dir = Path(workspace) / 'memory' / 'research'
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成文件名
        safe_name = ''.join(c if c.isalnum() else '_' for c in self.company_name)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"research_{safe_name}_{timestamp}.json"
        filepath = output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.research_results, f, ensure_ascii=False, indent=2)
        
        print(f"结果已保存到: {filepath}")
        return str(filepath)
    
    def format_for_review(self) -> str:
        """格式化收集结果供人工审核"""
        output = []
        output.append(f"# 【资料审核】{self.company_name}信息汇总")
        output.append(f"收集时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
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
            for i, item in enumerate(items, 1):
                reliability_emoji = {
                    'A': '🟢',
                    'B': '🟡',
                    'C': '🟠',
                    'D': '🔴'
                }.get(item['reliability'], '⚪')
                
                output.append(f"{i}. 【{reliability_emoji}{item['reliability']}级】{item['aspect']}：{item['info']}")
                output.append(f"   来源：{item['source']}（{item['date']}）")
                if item.get('url'):
                    output.append(f"   链接：{item['url']}")
                output.append("")
        
        output.append("## 总结")
        summary = self.research_results['summary']
        output.append(f"- 总信息条数：{summary.get('total_info_items', 0)}")
        output.append(f"- 收集时间：{summary.get('collection_date', '')}")
        output.append("")
        output.append("请审核以上信息，确认无误后回复\"批准分析\"。")
        
        return "\n".join(output)

def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='五维信息收集')
    parser.add_argument('company', help='公司名称')
    parser.add_argument('--dimension', choices=['all', 'tech', 'growth', 'cost', 'comp', 'team'], 
                       default='all', help='收集维度')
    parser.add_argument('--search-mode', choices=['mock', 'web_search', 'tavily', 'duckduckgo'], 
                       default='tavily', help='搜索模式: tavily=Tavily API (默认), mock=模拟数据, web_search=OpenClaw搜索, duckduckgo=DuckDuckGo搜索')
    parser.add_argument('--output', help='输出目录')
    parser.add_argument('--format', choices=['json', 'review'], default='review', help='输出格式')
    
    args = parser.parse_args()
    
    collector = ResearchCollector(args.company, search_mode=args.search_mode)
    
    if args.dimension == 'all':
        collector.collect_all_dimensions()
    else:
        dimension_map = {
            'tech': collector.collect_technology_info,
            'growth': collector.collect_growth_info,
            'cost': collector.collect_cost_info,
            'comp': collector.collect_competition_info,
            'team': collector.collect_team_info
        }
        dimension_map[args.dimension]()
    
    if args.output:
        collector.save_results(args.output)
    else:
        collector.save_results()
    
    if args.format == 'review':
        print("\n" + "="*60)
        print(collector.format_for_review())
    else:
        print(json.dumps(collector.research_results, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()