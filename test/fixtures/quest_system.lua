-- Quest System Configuration
-- @config-md: ./quest_system.config.md
-- @probe:quest_settings
-- @doc:quest-settings
QuestSystem = {
    Settings = {
        -- @doc:max-active-quests
        MaxActiveQuests = 5,
        AutoTrack = true,
        ShowNotifications = true,
        DailyResetHour = 4,
        -- @doc:exp-multiplier
        ExpMultiplier = 1.5,
        -- @doc:difficulty
        Difficulty = "normal"
    },

    -- @probe:reward_table
    -- @doc:reward-table
    Rewards = {
        { id = 1001, name = "Beginner Pack",   exp = 100,  gold = 50,   rare = false },
        { id = 1002, name = "Warrior Trial",    exp = 300,  gold = 150,  rare = false },
        { id = 1003, name = "Dragon Slayer",    exp = 1000, gold = 500,  rare = true  },
        { id = 1004, name = "Ancient Mystery",  exp = 2000, gold = 1000, rare = true  },
    },
}

-- @probe:quest_complete_handler
-- @doc:quest-completion-handler
-- Quest completion callback
function QuestSystem.onQuestComplete(player, quest)
    local reward = QuestSystem.Rewards[quest.rewardIndex]
    if not reward then return end

    -- @probe:exp_calculation
    local exp = reward.exp * QuestSystem.Settings.ExpMultiplier
    player:addExp(exp)
    player:addGold(reward.gold)

    -- @probe:rare_quest_logic
    -- @doc:./quest_system.config.md#quest-state-machine
    if reward.rare then
        player:showCelebration("rare_quest_complete")
        player:grantAchievement("rare_collector")
    end

    if QuestSystem.Settings.ShowNotifications then
        player:notify("Quest Complete: " .. quest.name)
    end
end
