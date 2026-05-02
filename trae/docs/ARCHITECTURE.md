# 项目架构

## 文件结构
```
anniversary/
├── .gitignore             # Git 忽略规则
├── anniversary.html      # 主页面
├── anniversary.css       # 样式表
├── anniversary.js        # JavaScript (星星、烟花、萤火虫)
├── images/
│   ├── photo_1.jpeg      # 幻灯片图片 1
│   ├── photo_2.jpeg      # 幻灯片图片 2
│   ├── photo_3.jpeg      # 幻灯片图片 3
│   └── photo_4.jpeg      # 幻灯片图片 4
├── AGENTS.md             # 项目说明
└── trae/docs/
    ├── ARCHITECTURE.md   # 本文件
    ├── TODO.md           # 功能清单
    ├── TASKS.md          # 任务列表
    └── STATUS.md         # 项目状态
```

## 图层层级 (z-index)
| z-index | 元素 |
|---------|------|
| 0       | 星空背景 (sky) |
| 1       | 星云薄雾 (nebula) |
| 2       | 星星 (stars) |
| 3       | 山峦 (mountain) / 萤火虫 |
| 4       | 幻灯片轮播 / 顶部装饰 / 底部花体字 |
| 7       | 烟花画布 (fireworks-canvas) |
| 8       | 暗角 (vignette) |
| 9       | 颗粒纹理 (grain) |

## 关键设计
- 全屏单页，overflow: hidden
- 响应式支持 (max-width: 768px)
- 所有动效纯 CSS + JavaScript
