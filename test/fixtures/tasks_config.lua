-- Task Configuration Table
-- Defines available tasks/missions in the game

TasksConfig = {
    -- Main Story Tasks
    MainTasks = {
        { id = 101, name = "The Beginning", description = "Start your adventure", type = "story", required_level = 1, reward_exp = 100, reward_gold = 50, time_limit = 0, repeatable = false },
        { id = 102, name = "Village Defense", description = "Protect the village from goblins", type = "story", required_level = 3, reward_exp = 300, reward_gold = 150, time_limit = 0, repeatable = false },
        { id = 103, name = "The Dark Forest", description = "Explore the mysterious dark forest", type = "story", required_level = 5, reward_exp = 500, reward_gold = 250, time_limit = 0, repeatable = false },
},

    -- Daily Tasks
    DailyTasks = {
        { id = 201, name = "Gather Herbs", description = "Collect 10 healing herbs", type = "gather", required_level = 1, reward_exp = 50, reward_gold = 30, time_limit = 3600, repeatable = true },
        { id = 202, name = "Monster Hunt", description = "Defeat 5 wild monsters", type = "combat", required_level = 2, reward_exp = 80, reward_gold = 60, time_limit = 7200, repeatable = true },
        { id = 203, name = "Delivery Run", description = "Deliver supplies to the outpost", type = "delivery", required_level = 1, reward_exp = 40, reward_gold = 100, time_limit = 1800, repeatable = true },
    },

    -- Settings
    Settings = {
        MaxActiveTasks = 5,
        DailyTaskRefreshHour = 4,
        TaskExpMultiplier = 1.0,
    }
}

return TasksConfig
