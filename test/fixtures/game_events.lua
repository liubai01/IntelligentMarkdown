-- 游戏事件系统
-- 管理游戏中各种事件的回调函数和相关配置
-- 最后修改：2025-02-14

GameEvents = {
    -- 事件系统全局设置
    Settings = {
        EnableLog = true,
        MaxRetries = 3,
        EventQueueSize = 256
    },

    -- 玩家死亡事件
    onPlayerDeath = function(player, killer)
        local deathPos = player:GetPosition()
        print("[Event] Player " .. player.name .. " died at " .. tostring(deathPos))

        -- 掉落物品
        local dropRate = 0.3
        if math.random() < dropRate then
            local item = player:GetRandomItem()
            if item then
                World:SpawnDrop(item, deathPos)
                print("[Event] Dropped: " .. item.name)
            end
        end

        -- 复活计时
        player:StartRespawnTimer(10)
    end,

    -- 玩家升级事件
    onPlayerLevelUp = function(player, newLevel)
        print("[Event] Player " .. player.name .. " reached level " .. newLevel)

        -- 恢复满血满蓝
        player:SetHP(player:GetMaxHP())
        player:SetMP(player:GetMaxMP())

        -- 解锁新技能
        local skillUnlocks = {
            [5]  = 2001,  -- 5级解锁火球术
            [10] = 2002,  -- 10级解锁冰冻术
            [15] = 2003,  -- 15级解锁雷电术
            [20] = 2004   -- 20级解锁治愈术
        }

        local skillId = skillUnlocks[newLevel]
        if skillId then
            player:UnlockSkill(skillId)
            UI:ShowNotification("New skill unlocked!")
        end

        -- 播放升级特效
        VFX:Play("level_up", player:GetPosition())
        Sound:Play("sfx_level_up")
    end,

    -- 怪物被击杀事件
    onMonsterKilled = function(monster, killer)
        local expReward = monster.baseExp * (1 + killer:GetExpBonus())
        local goldReward = monster.baseGold

        -- 发放奖励
        killer:AddExp(expReward)
        killer:AddGold(goldReward)

        -- Boss 额外掉落
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
