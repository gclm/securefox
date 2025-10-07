# 修复点击信用卡/笔记白屏问题

## 问题描述
用户报告点击信用卡和笔记按钮时出现白屏，浏览器控制台报告React Hooks渲染错误。

## 错误信息
```
Uncaught Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

## 根本原因
TypeScript类型定义不完整：
- uiStore中的activeView类型缺少'notes'选项
- EntryList组件的view prop类型定义不完整

## 修复计划
1. ✓ 修复 uiStore.ts 的 activeView 类型定义
2. ✓ 修复 EntryList.tsx 的 React Hooks 顺序问题
3. ✓ 修复导入路径错误

## 新的优化需求
1. 解决笔记页面嵌套问题
2. 删除信用卡、笔记页面的新增操作，统一使用右上角新增按钮
3. 优化搜索操作，根据底部菜单栏选择的类型过滤搜索范围
