-- Player Configuration Table
-- Author: Game Programming Team
-- Last modified: 2024-01-15

PlayerConfig = {
    -- Base Stats
    BaseStats = {
        HP = 4800,      -- Base health points
        MP = 650,       -- Base mana points
        Attack = 465,   -- Base attack power
        Defense = 50,   -- Base defense
        MoveSpeed = 440 -- Movement speed
    },
    
    -- Skill Configuration
    Skills = {
        DefaultSkillId = 1001,  -- Default skill
        MaxSkillSlots = 4,      -- Max skill slots
    },
    
    -- Other Settings
    Settings = {
        ShowTutorial = true,
        Language = "zh-CN",
        Difficulty = "normal"
    }
}

return PlayerConfig
