-- Quest System Configuration
-- @probe:quest_settings
QuestSystem = {
    Settings = {
        MaxActiveQuests = 5,
        AutoTrack = true,
        ShowNotifications = true,
        DailyResetHour = 4,
        ExpMultiplier = 1.5,
        Difficulty = "normal"
    },

    -- @probe:reward_table
    Rewards = {
        { id = 1001, name = "Beginner Pack",   exp = 100,  gold = 50,   rare = false },
        { id = 1002, name = "Warrior Trial",    exp = 300,  gold = 150,  rare = false },
        { id = 1003, name = "Dragon Slayer",    exp = 1000, gold = 500,  rare = true  },
        { id = 1004, name = "Ancient Mystery",  exp = 2000, gold = 1000, rare = true  },
    },
}

-- @probe:quest_complete_handler
-- Quest completion callback
function QuestSystem.onQuestComplete(player, quest)
    local reward = QuestSystem.Rewards[quest.rewardIndex]
    if not reward then return end

    -- @probe:exp_calculation
    local exp = reward.exp * QuestSystem.Settings.ExpMultiplier
    player:addExp(exp)
    player:addGold(reward.gold)

    -- @probe:rare_quest_logic
    if reward.rare then
        player:showCelebration("rare_quest_complete")
        player:grantAchievement("rare_collector")
    end

    if QuestSystem.Settings.ShowNotifications then
        player:notify("Quest Complete: " .. quest.name)
    end
end
