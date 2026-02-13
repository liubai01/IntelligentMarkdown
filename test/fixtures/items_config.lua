-- 物品配置表
-- 用于配置游戏中的物品属性

ItemsConfig = {
    -- 武器列表
    Weapons = {
        { id = 1001, name = "木剑", attack = 10, price = 50, stackable = true },
        { id = 1002, name = "铁剑", attack = 25, price = 200, stackable = true },
        { id = 1003, name = "钢剑", attack = 45, price = 500, stackable = true },
        { id = 1004, name = "神圣之剑", attack = 100, price = 2000, stackable = false }
    },
    
    -- 药水列表
    Potions = {
        { id = 2001, name = "小生命药水", effect = "heal", value = 50, price = 20, stackable = true },
        { id = 2002, name = "中生命药水", effect = "heal", value = 150, price = 80, stackable = true },
        { id = 2003, name = "大生命药水", effect = "heal", value = 300, price = 200, stackable = true }
    }
}

return ItemsConfig
