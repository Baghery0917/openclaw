# DESIGN.md - AI投资分析报告设计系统

基于专业金融科技平台设计原则，专为AI投资分析报告优化的设计系统。

## 1. 视觉主题与氛围

**主题**: 专业、可信赖、数据驱动
**氛围**: 冷静、精确、前瞻性
**设计理念**: 最小化干扰，最大化信息清晰度
**密度**: 中等密度，平衡信息密度与可读性

## 2. 色彩体系与语义角色

### 主色调
- `--primary-900`: #0f172a (深蓝色 - 主标题、重要元素)
- `--primary-800`: #1e293b (导航、边框)
- `--primary-700`: #334155 (次级文本)
- `--primary-600`: #475569 (辅助文本)

### 强调色
- `--accent-600`: #2563eb (主要行动点、链接)
- `--accent-500`: #3b82f6 (悬浮状态)
- `--accent-400`: #60a5fa (轻度强调)

### 语义色
- `--success-600`: #059669 (正面数据、增长)
- `--success-100`: #d1fae5 (成功背景)
- `--warning-600`: #d97706 (警告、中等风险)
- `--warning-100`: #fef3c7 (警告背景)
- `--danger-600`: #dc2626 (危险、高风险)
- `--danger-100`: #fee2e2 (危险背景)

### 中性色
- `--gray-900`: #111827 (主要文本)
- `--gray-700`: #374151 (次级文本)
- `--gray-400`: #9ca3af (禁用状态)
- `--gray-100`: #f3f4f6 (背景色)
- `--gray-50`: #f9fafb (卡片背景)

### 渐变
- `--gradient-primary`: linear-gradient(135deg, #0f172a 0%, #1e293b 100%)
- `--gradient-accent`: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)

## 3. 排版规则

### 字体家族
- **主要字体**: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- **等宽字体**: 'SF Mono', 'Roboto Mono', Consolas, monospace

### 字体层级
| 样式 | 字号 | 字重 | 行高 | 使用场景 |
|------|------|------|------|----------|
| H1 | 48px | 700 | 1.1 | 报告主标题 |
| H2 | 32px | 700 | 1.2 | 章节标题 |
| H3 | 24px | 600 | 1.3 | 子章节标题 |
| H4 | 18px | 600 | 1.4 | 小标题 |
| Body Large | 18px | 400 | 1.6 | 正文大号 |
| Body | 16px | 400 | 1.6 | 正文 |
| Body Small | 14px | 400 | 1.5 | 辅助文本 |
| Caption | 12px | 400 | 1.4 | 标注、图注 |

### 字体特性
- 字母间距: -0.01em (标题), 0 (正文)
- 文本转换: 无 (保持自然大小写)
- 文本装饰: 仅链接使用下划线

## 4. 组件样式

### 按钮
```css
.btn-primary {
  background: var(--accent-600);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--accent-500);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}
```

### 卡片
```css
.card {
  background: white;
  border-radius: 12px;
  border: 1px solid var(--gray-200);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 24px;
  transition: all 0.2s;
}

.card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
```

### 输入框
```css
.input {
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 16px;
  transition: all 0.2s;
}

.input:focus {
  border-color: var(--accent-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

### 徽章
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.badge-success {
  background: var(--success-100);
  color: var(--success-700);
}

.badge-warning {
  background: var(--warning-100);
  color: var(--warning-700);
}

.badge-danger {
  background: var(--danger-100);
  color: var(--danger-700);
}
```

## 5. 布局原则

### 间距系统 (8px基准)
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-12`: 48px
- `--space-16`: 64px

### 网格系统
- 内容宽度: 1200px max-width
- 栅格: 12列网格
- 间距: 24px (列间距)

### 白边哲学
- 最小边距: 24px
- 段落间距: 1.5em
- 章节间距: 64px

## 6. 深度与层次

### 阴影系统
- `--shadow-sm`: 0 1px 2px rgba(0, 0, 0, 0.05)
- `--shadow-md`: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- `--shadow-lg`: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
- `--shadow-xl`: 0 20px 25px -5px rgba(0, 0, 0, 0.1)

### 表面层级
1. 基础层 (z-index: 0) - 页面背景
2. 内容层 (z-index: 10) - 主要内容
3. 浮动层 (z-index: 100) - 悬浮卡片、工具提示
4. 覆盖层 (z-index: 1000) - 模态框、下拉菜单

## 7. 应该做与不应该做

### ✅ 应该做
- 使用一致的间距系统
- 保持足够的对比度 (WCAG AA标准)
- 在交互元素上提供视觉反馈
- 使用语义化颜色编码
- 保持设计简洁，专注于内容

### ❌ 不应该做
- 不使用过度鲜艳的颜色
- 避免使用超过3种主色
- 不要过度使用阴影和渐变
- 避免过小的点击目标
- 不要忽略移动端适配

## 8. 响应式行为

### 断点
- `sm`: 640px (手机)
- `md`: 768px (平板)
- `lg`: 1024px (笔记本)
- `xl`: 1280px (桌面)
- `2xl`: 1536px (大桌面)

### 触摸目标
- 最小尺寸: 44px × 44px
- 内边距: 至少8px

### 折叠策略
- 移动端: 单列布局
- 平板: 两列布局
- 桌面: 多列网格

## 9. AI提示指南

### 快速颜色参考
```css
/* 主色 */
--primary: #0f172a;
--primary-light: #1e293b;

/* 强调色 */
--accent: #2563eb;
--accent-light: #3b82f6;

/* 语义色 */
--success: #059669;
--warning: #d97706;
--danger: #dc2626;

/* 中性色 */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-900: #111827;
```

### 组件提示
- 使用 `.card` 类创建卡片
- 使用 `.badge-{type}` 创建状态徽章
- 使用 `.metric-card` 创建数据指标卡片
- 保持一致的 `border-radius: 12px`

### 布局提示
- 使用 `max-width: 1200px` 限制内容宽度
- 使用 `gap: 24px` 作为网格间距
- 使用 `padding: 24px` 作为卡片内边距
- 保持 `line-height: 1.6` 用于正文

---

**设计系统版本**: 1.0.0  
**最后更新**: 2026-04-14  
**适用场景**: AI投资分析报告、金融数据可视化、专业文档渲染