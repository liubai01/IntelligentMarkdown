-- GenericGameplayActor: interactive actor for patrol + overlap-trigger interactions.
-- Spawn: external-managed | Replication: server-authoritative
-- Extension points: AI logic, custom abilities.

local GenericGameplayActor = {}

-- Tunables
local CONFIG = {
    BlueprintClassPath = "/Game/TestActor.TestActor_C",
    PatrolSpeed = 200.0,
    PatrolWaitTime = 1.0,
    OverlapRadius = 100.0,
    CooldownDuration = 2.0,
    DebugLogEnabled = false,
    SpawnStrategy = "external-managed", -- none | single | pooled | wave | external-managed
    MovementModel = "patrol",          -- none | patrol | seek | orbit | custom-curve
    InteractionModel = "overlap-trigger",
}

local EPropertyClass = import("EPropertyClass")
local ELifetimeCondition = import("ELifetimeCondition")

function GenericGameplayActor:ctor()
    self.PatrolPoints = {}
    self.CurrentPatrolIndex = 0
    self.PatrolWaitTimer = 0.0
    self.StateMachine = nil
    self.CooldownEndTime = 0.0
    self.TargetActor = nil
    self.bIsOverlapping = false
    self.bCanEverTick = false
end

function GenericGameplayActor:GetLifetimeReplicatedProps()
    return {
        { "CurrentPatrolIndex", ELifetimeCondition.COND_ServerOnly, EPropertyClass.Int },
        { "TargetActor", ELifetimeCondition.COND_ServerOnly, EPropertyClass.Object },
    }
end

-- Extension: override to inject AI logic
function GenericGameplayActor:OnAIUpdate(DeltaTime)
end

-- Extension: override for custom abilities
function GenericGameplayActor:OnAbilityTriggered(AbilityName, Target)
end

-- Extension: override for custom movement
function GenericGameplayActor:OnMovementUpdate(DeltaTime)
end

-- Extension: override for custom target selection
function GenericGameplayActor:OnTargetSelected(Actor)
end

function GenericGameplayActor:SetPatrolPoints(Points)
    if not Points or type(Points) ~= "table" then return end
    self.PatrolPoints = Points
end

function GenericGameplayActor:Init()
    if not self then return end
    self.CurrentPatrolIndex = 0
    self.PatrolWaitTimer = 0.0
    self.CooldownEndTime = 0.0
    self.TargetActor = nil
    self.bIsOverlapping = false
    self:InitStateMachine()
    if CONFIG.DebugLogEnabled then
        print("GenericGameplayActor:Init")
    end
end

function GenericGameplayActor:InitStateMachine()
    self.StateMachine = {
        Current = "idle",
        States = { idle = true, patrol = true, reacting = true, cooldown = true },
    }
end

function GenericGameplayActor:SetState(NewState)
    if not self.StateMachine or not self.StateMachine.States[NewState] then return end
    self.StateMachine.Current = NewState
    if CONFIG.DebugLogEnabled then
        print("GenericGameplayActor:State -> ", NewState)
    end
end

function GenericGameplayActor:IsOnCooldown()
    local World = self and self:GetWorld()
    if not World then return true end
    return World:GetTimeSeconds() < self.CooldownEndTime
end

function GenericGameplayActor:StartCooldown()
    local World = self and self:GetWorld()
    if not World then return end
    self.CooldownEndTime = World:GetTimeSeconds() + CONFIG.CooldownDuration
    self:SetState("cooldown")
end

function GenericGameplayActor:UpdatePatrol(DeltaTime)
    if CONFIG.MovementModel ~= "patrol" then return end
    local Points = self.PatrolPoints
    if not Points or #Points < 2 then return end

    if self.PatrolWaitTimer > 0.0 then
        self.PatrolWaitTimer = self.PatrolWaitTimer - DeltaTime
        return
    end

    local KismetMathLibrary = import("KismetMathLibrary")
    local CurrentPos = self:GetActorLocation()
    local NextIdx = (self.CurrentPatrolIndex % #Points) + 1
    local NextPoint = Points[NextIdx]
    if not NextPoint then return end

    local ToTarget = NextPoint - CurrentPos
    local Dist = KismetMathLibrary.VSize(ToTarget)
    if Dist and Dist < 5.0 then
        self.CurrentPatrolIndex = NextIdx
        self.PatrolWaitTimer = CONFIG.PatrolWaitTime
        return
    end

    local Dir = KismetMathLibrary.Normal(ToTarget)
    if Dir then
        local NewPos = CurrentPos + Dir * CONFIG.PatrolSpeed * DeltaTime
        self:SetActorLocation(NewPos)
    end
end

function GenericGameplayActor:UpdateTargetSelection()
    if CONFIG.InteractionModel ~= "overlap-trigger" then return end
    if not self.bIsOverlapping then
        self.TargetActor = nil
        return
    end
    -- Overlap target is set by OnOverlapBegin; selection hook for extension
    if self.TargetActor then
        self:OnTargetSelected(self.TargetActor)
    end
end

function GenericGameplayActor:UpdateMovement(DeltaTime)
    self:OnMovementUpdate(DeltaTime)
    if CONFIG.MovementModel == "patrol" then
        self:UpdatePatrol(DeltaTime)
    end
end

function GenericGameplayActor:Spawn()
    if CONFIG.SpawnStrategy == "external-managed" or CONFIG.SpawnStrategy == "none" then
        return nil
    end
    local World = self and self:GetWorld()
    if not World then return nil end
    local Class = LoadClass(nil, nil, CONFIG.BlueprintClassPath)
    if not Class then return nil end
    local SpawnTransform = self:GetActorTransform()
    return World:SpawnActor(Class, SpawnTransform)
end

function GenericGameplayActor:Cleanup()
    self.PatrolPoints = {}
    self.TargetActor = nil
    self.StateMachine = nil
    if CONFIG.DebugLogEnabled then
        print("GenericGameplayActor:Cleanup")
    end
end

function GenericGameplayActor:OnOverlapBegin(OtherActor)
    if not OtherActor then return end
    self.bIsOverlapping = true
    self.TargetActor = OtherActor
    if self:IsOnCooldown() then return end
    self:SetState("reacting")
    self:OnAbilityTriggered("overlap_react", OtherActor)
    self:StartCooldown()
end

function GenericGameplayActor:OnOverlapEnd(OtherActor)
    if not OtherActor then return end
    self.bIsOverlapping = false
    if self.TargetActor == OtherActor then
        self.TargetActor = nil
    end
end

function GenericGameplayActor:ReceiveBeginPlay()
    self.bCanEverTick = true
    self:Init()
    if CONFIG.DebugLogEnabled then
        print("GenericGameplayActor:ReceiveBeginPlay")
    end
end

function GenericGameplayActor:ReceiveTick(DeltaTime)
    if not self or not DeltaTime then return end
    if self:IsOnCooldown() then
        local World = self:GetWorld()
        if World and World:GetTimeSeconds() >= self.CooldownEndTime then
            self:SetState("idle")
        end
    end
    self:UpdateTargetSelection()
    self:UpdateMovement(DeltaTime)
    self:OnAIUpdate(DeltaTime)
end

function GenericGameplayActor:ReceiveEndPlay(Reason)
    self:Cleanup()
    if CONFIG.DebugLogEnabled then
        print("GenericGameplayActor:ReceiveEndPlay")
    end
end

return Class(nil, nil, GenericGameplayActor)
