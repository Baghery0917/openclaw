# 真实联网搜索功能集成指南

## 概述

本指南说明如何将 `investment-xhs` skill 升级为具有真正联网搜索能力的版本。当前版本中的 `research_collector.py` 使用模拟数据，而增强版将实际调用 OpenClaw 的 web 工具进行信息收集。

## 当前架构 vs 增强架构

### 当前架构（模拟数据）
```
用户请求 → agent调用skill → research_collector.py → 返回模拟数据 → 后续处理
```

### 增强架构（真实搜索）
```
用户请求 → agent调用skill → enhanced_research_collector.py → 
    ↓
生成搜索查询 → agent执行web_search/web_fetch → 
    ↓
返回真实数据 → 解析和整理 → 后续处理
```

## 集成方案

### 方案一：Python脚本直接调用工具（推荐但需要开发）

在 `research_collector_enhanced.py` 中实现真正的工具调用：

```python
# 需要实现真实的工具调用接口
def execute_real_web_search(self, query: str) -> List[Dict]:
    """调用OpenClaw web_search工具"""
    # 方法1：通过subprocess调用openclaw CLI（如果支持）
    # 方法2：通过HTTP调用本地网关API
    # 方法3：通过OpenClaw Python SDK（如果可用）
```

### 方案二：混合架构（当前实现）

Python脚本生成搜索指令，由agent执行：

1. `enhanced_research_collector.py` 生成结构化搜索查询
2. agent读取查询并执行 `web_search`/`web_fetch`
3. 将搜索结果传递回脚本进行解析

### 方案三：完整agent驱动

将搜索逻辑完全移到agent层面：
- agent直接调用web工具收集信息
- 将结果传递给数据处理脚本
- 更适合OpenClaw的ReAct范式

## 实现步骤

### 步骤1：配置web工具访问

确保OpenClaw配置中启用了web工具：

```json
{
  "tools": {
    "web_search": {
      "enabled": true,
      "provider": "duckduckgo"
    },
    "web_fetch": {
      "enabled": true
    },
    "browser": {
      "enabled": true,
      "profiles": ["openclaw"]
    }
  }
}
```

### 步骤2：实现工具调用接口

在 `research_collector_enhanced.py` 中添加真实工具调用：

```python
import requests

class RealWebSearchMixin:
    def __init__(self):
        self.gateway_url = "http://localhost:26976"
        self.api_key = os.environ.get("OPENCLAW_API_KEY", "")
    
    def call_openclaw_tool(self, tool_name: str, params: Dict) -> Dict:
        """调用OpenClaw工具API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "tool": tool_name,
            "params": params
        }
        
        try:
            response = requests.post(
                f"{self.gateway_url}/api/tools/execute",
                json=payload,
                headers=headers,
                timeout=30
            )
            return response.json()
        except Exception as e:
            print(f"工具调用失败: {e}")
            return {}
    
    def real_web_search(self, query: str, count: int = 5) -> List[Dict]:
        """真实web搜索"""
        result = self.call_openclaw_tool("web_search", {
            "query": query,
            "count": count
        })
        return result.get("results", [])
    
    def real_web_fetch(self, url: str) -> Optional[str]:
        """真实网页抓取"""
        result = self.call_openclaw_tool("web_fetch", {
            "url": url,
            "extractMode": "markdown"
        })
        return result.get("content")
```

### 步骤3：更新工作流程

修改SKILL.md中的步骤2（五维信息收集）：

```markdown
### 步骤2：五维信息收集（增强版）

**新流程**：
1. 为每个维度生成具体搜索查询
2. 调用 `web_search` 获取信息来源
3. 使用 `web_fetch` 获取详细内容
4. 提取和整理结构化信息
5. 自动评估信息可靠性

**执行方式**：
```bash
# 使用增强版收集器
python scripts/research_collector_enhanced.py "商汤科技" --dimension all --format review

# 或者通过agent调用
agent: "请使用investment-xhs skill收集商汤科技的五个维度信息，使用真实联网搜索"
```

### 步骤4：测试和验证

创建测试脚本验证功能：

```python
# test_real_search.py
from research_collector_enhanced import EnhancedResearchCollector

collector = EnhancedResearchCollector("商汤科技")
result = collector.collect_dimension_info("technology")
print(f"收集到 {result['count']} 条技术信息")
```

## 搜索策略优化

### 1. 智能查询生成
- 结合公司中英文名称
- 包含行业关键词（AI、机器学习、计算机视觉）
- 添加时间范围限制（最近1年）
- 包含特定信息来源（财报、官网、专利库）

### 2. 多源验证
- 同一信息从多个来源获取
- 交叉验证可靠性
- 优先级：官方来源 > 权威媒体 > 一般媒体

### 3. 失败处理
- 查询无结果时尝试同义词
- 网页无法访问时尝试替代来源
- 设置超时和重试机制

## 数据质量保障

### 可靠性分级标准
- **A级**：公司官网、SEC备案、专利局、政府文件
- **B级**：权威媒体（36氪、TechCrunch）、分析师报告、学术论文
- **C级**：一般媒体、社交媒体官方账号、数据平台
- **D级**：匿名来源、未验证传闻

### 信息新鲜度
- 优先最近6个月的信息
- 财务数据使用最新财年
- 技术信息关注最新进展

## 性能考虑

### 搜索限制
- 每个维度最多3个查询
- 每个查询最多5个结果
- 每个网页最多提取3条信息
- 总收集时间控制在3分钟内

### 缓存机制
- 相同公司24小时内不重复搜索
- 保存原始搜索结果供审计
- 建立信息数据库供后续分析使用

## 故障排除

### 常见问题
1. **web_search返回空结果**
   - 检查查询关键词是否准确
   - 尝试英文或拼音查询
   - 调整搜索时间范围

2. **web_fetch获取失败**
   - 检查URL可访问性
   - 尝试使用browser工具处理JS页面
   - 寻找替代信息来源

3. **信息提取不准确**
   - 调整提取关键词
   - 增加文本预处理
   - 人工审核修正

### 调试模式
```python
# 启用详细日志
collector = EnhancedResearchCollector("测试公司", debug=True)
# 查看原始搜索结果
print(json.dumps(collector.research_results['raw_data'], indent=2))
```

## 后续优化方向

### 短期优化
1. 实现真实的工具调用接口
2. 增加更多数据源（天眼查、企查查、Crunchbase）
3. 优化信息提取算法

### 中期优化
1. 集成机器学习进行信息分类
2. 建立公司信息知识库
3. 实现自动信息更新

### 长期优化
1. 多语言支持（英文、日文、韩文）
2. 实时信息监控
3. 预测性分析能力

## 总结

通过本集成指南，`investment-xhs` skill 可以从模拟数据升级为真实的联网搜索能力，显著提高投资分析报告的准确性和时效性。关键成功因素包括：

1. **正确的工具集成**：确保OpenClaw web工具可正常调用
2. **智能搜索策略**：生成有效的查询，获取高质量信息
3. **严格质量管控**：可靠性评估和交叉验证
4. **持续优化迭代**：根据使用反馈不断改进

这将使该skill成为真正实用的投资研究工具，为小红书内容创作提供可靠的数据支持。
