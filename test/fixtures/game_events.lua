-- Game Event System
-- Manages callback functions and related configuration for various in-game events
-- Last modified: 2025-02-14

GameEvents = {
    -- Event System Global Settings
    Settings = {
        EnableLog = true,
        MaxRetries = 3,
        EventQueueSize = 256
    },

    -- Player Death Event
    onPlayerDeath = function(player, killer)
        local deathPos = player:GetPosition()
        print("[Event] Player " .. player.name .. " died at " .. tostring(deathPos))

        -- Drop items
        local dropRate = 0.4
        if math.random() < dropRate then
            local item = player:GetRandomItem()
            if item then
                World:SpawnDrop(item, deathPos)
                print("[Event] Dropped: " .. item.name)
            end
        end

        -- Respawn timer
        player:StartRespawnTimer(10)
    end,

    -- Player Level Up Event
    onPlayerLevelUp = function(player, newLevel)
        print("[Event] Player " .. player.name .. " reached level " .. newLevel)

        -- Restore full HP and MP
        player:SetHP(player:GetMaxHP())
        player:SetMP(player:GetMaxMP())

        -- Unlock new skills
        local skillUnlocks = {
            [5]  = 2001,  -- Level 5: Fireball
            [10] = 2002,  -- Level 10: Frost Nova
            [15] = 2003,  -- Level 15: Lightning Bolt
            [20] = 2004   -- Level 20: Healing Light
        }

        local skillId = skillUnlocks[newLevel]
        if skillId then
            player:UnlockSkill(skillId)
            UI:ShowNotification("New skill unlocked!")
        end

        -- Play level up effects
        VFX:Play("level_up", player:GetPosition())
        Sound:Play("sfx_level_up")
    end,

    -- Monster Killed Event
    onMonsterKilled = function(monster, killer)
        local expReward = monster.baseExp * (1 + killer:GetExpBonus())
        local goldReward = monster.baseGold

        -- Grant rewards
        killer:AddExp(expReward)
        killer:AddGold(goldReward)

        -- Boss bonus loot
        if monster.isBoss then
            local lootTable = monster:GetBossLootTable()
            for _, loot in ipairs(lootTable) do
                if math.random() < loot.chance then
                    killer:AddItem(loot.itemId, loot.count)
                end
            end
            World:BroadcastMessage(killer.name .. " defeated " .. monster.name .. "!")
        end
    end
}

return GameEvents
