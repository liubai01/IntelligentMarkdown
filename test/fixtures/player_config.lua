-- 玩家配置表
-- 作者：游戏程序组
-- 最后修改：2024-01-15

PlayerConfig = {
    -- 基础属性
    BaseStats = {
        HP = 2900,      -- 基础生命值
        MP = 500,       -- 基础魔法值
        Attack = 375,   -- 基础攻击力
        Defense = 50,   -- 基础防御力
        MoveSpeed = 210 -- 移动速度
    },
    
    -- 技能配置
    Skills = {
        DefaultSkillId = 1001,  -- 默认技能
        MaxSkillSlots = 4,      -- 最大技能槽位
    },
    
    -- 其他配置
    Settings = {
        ShowTutorial = true,
        Language = "zh-CN",
        Difficulty = "normal"
    }
}

return PlayerConfig
