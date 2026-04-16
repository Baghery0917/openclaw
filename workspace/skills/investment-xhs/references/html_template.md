# HTML/CSS模板参考指南

## 模板文件结构

### 主模板文件：`report_template.html`
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{公司名称} - AI投资分析报告</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
    <!-- 报告容器 -->
    <div class="report-container">
        <!-- 封面页 -->
        <div class="page cover-page">
            <div class="cover-content">
                <div class="cover-badge">AI投资分析报告</div>
                <h1 class="company-name">{公司名称}</h1>
                <div class="cover-subtitle">深度五维分析报告</div>
                
                <div class="cover-metrics">
                    <div class="metric-item">
                        <div class="metric-value">{投资评级}</div>
                        <div class="metric-label">投资评级</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">{目标估值}</div>
                        <div class="metric-label">目标估值</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">{行业排名}</div>
                        <div class="metric-label">行业排名</div>
                    </div>
                </div>
                
                <div class="cover-footer">
                    <div class="report-date">报告日期：{YYYY年MM月DD日}</div>
                    <div class="analyst-name">分析师：OpenClaw Investment Research</div>
                    <div class="disclaimer">本报告仅供参考，不构成投资建议</div>
                </div>
            </div>
        </div>

        <!-- 执行摘要 -->
        <div class="page summary-page">
            <h2><i class="fas fa-bullseye"></i> 执行摘要</h2>
            <div class="executive-summary">
                {执行摘要内容}
            </div>
            
            <div class="key-metrics-grid">
                <div class="metric-card positive">
                    <div class="metric-title">技术评分</div>
                    <div class="metric-value">{技术评分}/10</div>
                    <div class="metric-desc">{技术亮点}</div>
                </div>
                <div class="metric-card positive">
                    <div class="metric-title">增长评分</div>
                    <div class="metric-value">{增长评分}/10</div>
                    <div class="metric-desc">{增长亮点}</div>
                </div>
                <div class="metric-card neutral">
                    <div class="metric-title">成本评分</div>
                    <div class="metric-value">{成本评分}/10</div>
                    <div class="metric-desc">{成本评价}</div>
                </div>
                <div class="metric-card positive">
                    <div class="metric-title">竞争评分</div>
                    <div class="metric-value">{竞争评分}/10</div>
                    <div class="metric-desc">{竞争优势}</div>
                </div>
                <div class="metric-card positive">
                    <div class="metric-title">团队评分</div>
                    <div class="metric-value">{团队评分}/10</div>
                    <div class="metric-desc">{团队亮点}</div>
                </div>
            </div>
        </div>

        <!-- 五维分析详情 -->
        <div class="page analysis-page">
            <h2><i class="fas fa-chart-network"></i> 五维深度分析</h2>
            
            <!-- 技术维度 -->
            <div class="dimension-section" id="technology">
                <h3><span class="dimension-icon">🔬</span> 技术维度</h3>
                <div class="dimension-content">
                    {技术维度内容}
                </div>
                <div class="reliability-badge reliability-a">可靠性：A级</div>
            </div>
            
            <!-- 增长维度 -->
            <div class="dimension-section" id="growth">
                <h3><span class="dimension-icon">📈</span> 增长维度</h3>
                <div class="dimension-content">
                    {增长维度内容}
                </div>
                <div class="reliability-badge reliability-b">可靠性：B级</div>
            </div>
            
            <!-- 成本维度 -->
            <div class="dimension-section" id="cost">
                <h3><span class="dimension-icon">💰</span> 成本维度</h3>
                <div class="dimension-content">
                    {成本维度内容}
                </div>
                <div class="reliability-badge reliability-c">可靠性：C级</div>
            </div>
            
            <!-- 竞争维度 -->
            <div class="dimension-section" id="competition">
                <h3><span class="dimension-icon">⚔️</span> 竞争维度</h3>
                <div class="dimension-content">
                    {竞争维度内容}
                </div>
                <div class="reliability-badge reliability-b">可靠性：B级</div>
            </div>
            
            <!-- 团队维度 -->
            <div class="dimension-section" id="team">
                <h3><span class="dimension-icon">👥</span> 团队维度</h3>
                <div class="dimension-content">
                    {团队维度内容}
                </div>
                <div class="reliability-badge reliability-a">可靠性：A级</div>
            </div>
        </div>

        <!-- 投资建议 -->
        <div class="page recommendation-page">
            <h2><i class="fas fa-lightbulb"></i> 投资建议</h2>
            
            <div class="recommendation-card {评级颜色}">
                <div class="recommendation-header">
                    <div class="recommendation-title">{投资评级}</div>
                    <div class="recommendation-subtitle">{评级说明}</div>
                </div>
                <div class="recommendation-body">
                    {投资建议正文}
                </div>
            </div>
            
            <div class="risk-section">
                <h4><i class="fas fa-exclamation-triangle"></i> 风险提示</h4>
                <ul class="risk-list">
                    {风险提示列表}
                </ul>
            </div>
        </div>

        <!-- 附录 -->
        <div class="page appendix-page">
            <h2><i class="fas fa-paperclip"></i> 附录</h2>
            
            <div class="appendix-section">
                <h4>信息可靠性评估</h4>
                <table class="reliability-table">
                    <thead>
                        <tr>
                            <th>信息类别</th>
                            <th>来源</th>
                            <th>可靠性等级</th>
                            <th>验证方法</th>
                        </tr>
                    </thead>
                    <tbody>
                        {可靠性表格行}
                    </tbody>
                </table>
            </div>
            
            <div class="disclaimer-section">
                <h4>免责声明</h4>
                <p>1. 本报告基于公开信息分析，仅供参考。</p>
                <p>2. 分析结果不构成投资建议，投资者需独立判断。</p>
                <p>3. 市场有风险，投资需谨慎。</p>
                <p>4. 报告日期：{YYYY年MM月DD日}，信息可能随时间变化。</p>
            </div>
        </div>
    </div>
</body>
</html>
```

### 样式表文件：`style.css`
```css
/* 基础样式 */
:root {
    --primary-color: #1a365d;
    --secondary-color: #2d74da;
    --accent-color: #00b894;
    --warning-color: #fdcb6e;
    --danger-color: #e17055;
    --text-primary: #2d3436;
    --text-secondary: #636e72;
    --background-light: #f9f9f9;
    --border-color: #dfe6e9;
    --shadow-light: 0 4px 6px rgba(0, 0, 0, 0.1);
    --shadow-medium: 0 10px 20px rgba(0, 0, 0, 0.15);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
    color: var(--text-primary);
    background-color: var(--background-light);
}

.report-container {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    box-shadow: var(--shadow-medium);
}

.page {
    padding: 60px 80px;
    min-height: 100vh;
    border-bottom: 1px solid var(--border-color);
}

.page:last-child {
    border-bottom: none;
}

/* 封面页样式 */
.cover-page {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-color) 0%, #2d74da 100%);
    color: white;
    text-align: center;
}

.cover-content {
    max-width: 800px;
}

.cover-badge {
    display: inline-block;
    background: rgba(255, 255, 255, 0.2);
    padding: 8px 20px;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 1px;
    margin-bottom: 40px;
}

.company-name {
    font-size: 72px;
    font-weight: 700;
    margin: 20px 0;
    line-height: 1.1;
}

.cover-subtitle {
    font-size: 24px;
    opacity: 0.9;
    margin-bottom: 60px;
}

.cover-metrics {
    display: flex;
    justify-content: center;
    gap: 60px;
    margin: 60px 0;
}

.metric-item {
    text-align: center;
}

.metric-value {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 8px;
}

.metric-label {
    font-size: 14px;
    opacity: 0.8;
    letter-spacing: 1px;
}

.cover-footer {
    margin-top: 80px;
    font-size: 14px;
    opacity: 0.7;
}

.report-date, .analyst-name {
    margin-bottom: 8px;
}

.disclaimer {
    margin-top: 20px;
    font-size: 12px;
    opacity: 0.6;
}

/* 标题样式 */
h1, h2, h3, h4 {
    color: var(--primary-color);
    margin-bottom: 24px;
}

h2 {
    font-size: 32px;
    font-weight: 700;
    border-bottom: 3px solid var(--secondary-color);
    padding-bottom: 12px;
    margin-bottom: 40px;
}

h3 {
    font-size: 24px;
    font-weight: 600;
    margin-top: 40px;
    margin-bottom: 20px;
}

h2 i, h3 span {
    margin-right: 12px;
}

/* 执行摘要 */
.executive-summary {
    font-size: 18px;
    line-height: 1.8;
    margin-bottom: 40px;
    padding: 30px;
    background: var(--background-light);
    border-radius: 12px;
    border-left: 4px solid var(--accent-color);
}

.key-metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
    margin-top: 40px;
}

.metric-card {
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    transition: transform 0.3s ease;
}

.metric-card:hover {
    transform: translateY(-5px);
}

.metric-card.positive {
    background: linear-gradient(135deg, #00b89420 0%, #00b89410 100%);
    border: 1px solid #00b89440;
}

.metric-card.neutral {
    background: linear-gradient(135deg, #fdcb6e20 0%, #fdcb6e10 100%);
    border: 1px solid #fdcb6e40;
}

.metric-title {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 12px;
}

.metric-value {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 8px;
}

.metric-desc {
    font-size: 12px;
    color: var(--text-secondary);
}

/* 维度分析 */
.dimension-section {
    margin-bottom: 50px;
    padding: 30px;
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    position: relative;
}

.dimension-content {
    font-size: 16px;
    line-height: 1.7;
}

.dimension-content p {
    margin-bottom: 16px;
}

.dimension-content ul, .dimension-content ol {
    margin-left: 24px;
    margin-bottom: 20px;
}

.dimension-icon {
    font-size: 28px;
    margin-right: 12px;
    vertical-align: middle;
}

/* 可靠性徽章 */
.reliability-badge {
    position: absolute;
    top: 30px;
    right: 30px;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.reliability-a {
    background: #00b89420;
    color: #00b894;
    border: 1px solid #00b89440;
}

.reliability-b {
    background: #2d74da20;
    color: #2d74da;
    border: 1px solid #2d74da40;
}

.reliability-c {
    background: #fdcb6e20;
    color: #fdcb6e;
    border: 1px solid #fdcb6e40;
}

/* 投资建议卡片 */
.recommendation-card {
    padding: 40px;
    border-radius: 16px;
    margin-bottom: 40px;
}

.recommendation-card.buy {
    background: linear-gradient(135deg, #00b89410 0%, #00b89405 100%);
    border: 2px solid #00b894;
}

.recommendation-card.hold {
    background: linear-gradient(135deg, #fdcb6e10 0%, #fdcb6e05 100%);
    border: 2px solid #fdcb6e;
}

.recommendation-card.sell {
    background: linear-gradient(135deg, #e1705510 0%, #e1705505 100%);
    border: 2px solid #e17055;
}

.recommendation-header {
    margin-bottom: 30px;
}

.recommendation-title {
    font-size: 48px;
    font-weight: 800;
    margin-bottom: 8px;
}

.recommendation-subtitle {
    font-size: 18px;
    color: var(--text-secondary);
}

.recommendation-body {
    font-size: 18px;
    line-height: 1.8;
}

/* 风险提示 */
.risk-section {
    padding: 30px;
    background: #fff5f5;
    border-radius: 12px;
    border-left: 4px solid #e17055;
}

.risk-list {
    list-style-type: none;
}

.risk-list li {
    padding: 12px 0;
    border-bottom: 1px solid #ffeaea;
}

.risk-list li:last-child {
    border-bottom: none;
}

.risk-list li::before {
    content: "⚠️";
    margin-right: 12px;
}

/* 表格样式 */
.reliability-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
}

.reliability-table th {
    background: var(--primary-color);
    color: white;
    padding: 16px;
    text-align: left;
    font-weight: 600;
}

.reliability-table td {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
}

.reliability-table tr:hover {
    background: var(--background-light);
}

/* 响应式设计 */
@media (max-width: 768px) {
    .page {
        padding: 40px 20px;
    }
    
    .company-name {
        font-size: 48px;
    }
    
    .cover-metrics {
        flex-direction: column;
        gap: 30px;
    }
    
    .key-metrics-grid {
        grid-template-columns: 1fr;
    }
    
    h2 {
        font-size: 24px;
    }
    
    h3 {
        font-size: 20px;
    }
}

/* 打印样式 */
@media print {
    .page {
        page-break-after: always;
        padding: 40px;
    }
    
    .cover-page {
        background: white !important;
        color: black !important;
    }
    
    .metric-card, .dimension-section {
        break-inside: avoid;
    }
}
```

## 模板变量说明

### 封面页变量
- `{公司名称}`：要分析的公司全名
- `{投资评级}`：买入/持有/卖出
- `{目标估值}`：如"10-15亿美元"或"N/A"
- `{行业排名}`：如"细分市场Top 3"
- `{YYYY年MM月DD日}`：报告生成日期

### 五维分析变量
- `{技术维度内容}`：技术分析详细内容
- `{增长维度内容}`：增长分析详细内容
- `{成本维度内容}`：成本分析详细内容
- `{竞争维度内容}`：竞争分析详细内容
- `{团队维度内容}`：团队分析详细内容

### 评分变量
- `{技术评分}`：1-10分
- `{增长评分}`：1-10分
- `{成本评分}`：1-10分
- `{竞争评分}`：1-10分
- `{团队评分}`：1-10分

### 投资建议变量
- `{评级颜色}`：buy/hold/sell（对应CSS类名）
- `{评级说明}`：评级的具体说明文字
- `{投资建议正文}`：详细的投资建议内容
- `{风险提示列表}`：HTML列表格式的风险提示

### 可靠性表格变量
- `{可靠性表格行}`：多个表格行的HTML代码

## 使用指南

### 1. 模板填充步骤
1. 复制`report_template.html`到工作目录
2. 复制`style.css`到同一目录
3. 使用Python脚本或手动替换所有`{变量名}`
4. 保存为新的HTML文件

### 2. 自动化填充脚本
建议创建Python脚本自动填充模板：

```python
import jinja2

template = jinja2.Template(html_content)
rendered = template.render(
    company_name="示例公司",
    investment_rating="买入",
    # ... 其他变量
)

with open("output.html", "w", encoding="utf-8") as f:
    f.write(rendered)
```

### 3. 浏览器渲染步骤
1. 使用`browser(action='open', url='file:///path/to/output.html')`
2. 等待页面加载完成
3. 使用`browser(action='screenshot', fullPage=True, type='png')`
4. 保存截图文件

### 4. 样式定制建议
- 修改`:root`中的颜色变量调整主题色
- 调整`.page`的`padding`改变页面边距
- 修改字体大小适应不同屏幕
- 添加公司Logo到封面页