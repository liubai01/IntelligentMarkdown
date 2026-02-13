# 物品配置文档

本文档用于批量管理游戏中的物品配置，支持表格形式批量编辑。

## 武器列表

以下是游戏中所有武器的配置表格，可以直接在表格中修改属性：

```lua-config
file: ./items_config.lua
key: ItemsConfig.Weapons
type: table
label: 武器配置表
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "80px" }
  - { key: "name", label: "武器名称", type: "string", width: "150px" }
  - { key: "attack", label: "攻击力", type: "number", min: 1, max: 999, step: 5, width: "100px" }
  - { key: "price", label: "价格", type: "number", min: 0, max: 99999, step: 10, width: "100px" }
  - { key: "stackable", label: "可堆叠", type: "boolean", width: "80px" }
```

## 药水列表

药水的效果类型可以从下拉菜单中选择：

```lua-config
file: ./items_config.lua
key: ItemsConfig.Potions
type: table
label: 药水配置表
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "80px" }
  - { key: "name", label: "药水名称", type: "string", width: "150px" }
  - { key: "effect", label: "效果类型", type: "select", width: "120px", options: [{ value: "heal", label: "治疗" }, { value: "mana", label: "魔法" }, { value: "buff", label: "增益" }] }
  - { key: "value", label: "效果数值", type: "number", min: 1, max: 9999, step: 10, width: "100px" }
  - { key: "price", label: "价格", type: "number", min: 0, max: 9999, step: 5, width: "100px" }
  - { key: "stackable", label: "可堆叠", type: "boolean", width: "80px" }
```

## 使用说明

- **ID 列**：只读，不可修改
- **名称列**：文本输入
- **数值列**：数字输入，有范围限制
- **可堆叠列**：复选框，直接点击切换
- **效果类型**：下拉选择
