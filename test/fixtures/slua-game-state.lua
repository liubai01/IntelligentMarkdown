-- Fixture adapted from slua-unreal LuaGameState.lua:
-- https://github.com/Tencent/sluaunreal/blob/master/Content/Lua/LuaGameState.lua
-- Intentionally kept close to the original script layout and symbols.

local LuaGameState =
{
    ServerRPC = {},
    ClientRPC = {},
    MulticastRPC = {},
}

local EPropertyClass = import("EPropertyClass")

LuaGameState.ServerRPC.TestServerRPC = {
    Reliable = true,
    Params =
    {
        EPropertyClass.Int,
        EPropertyClass.Str,
        EPropertyClass.bool,
    }
}

LuaGameState.ClientRPC.TestClientRPC = {
    Reliable = true,
    Params =
    {
        EPropertyClass.Int,
        EPropertyClass.Str,
        EPropertyClass.bool,
    }
}

LuaGameState.MulticastRPC.TestMulticastRPC = {
    Reliable = true,
    Params =
    {
        EPropertyClass.Int,
        EPropertyClass.Str,
        EPropertyClass.bool,
    }
}

function LuaGameState:ctor()
    print("LuaGameState ctor", assert(selfType == require("LuaGameState")))
    self.Name = "LuaGameStateTestName"
    self.TickCounter = 0
end

function LuaGameState:_PostConstruct()
    self:AddLuaNetListener("Position", function (Value)
        print("LuaGameState On Position Assign:", Value.X, Value.Y, Value.Z)
    end)
end

function LuaGameState:TestServerRPC(ArgInt, ArgStr, ArgBool)
    print("LuaGameState:TestServerRPC", ArgInt, ArgStr, ArgBool)
end

function LuaGameState:TestClientRPC(ArgInt, ArgStr, ArgBool)
    print("LuaGameState:TestClientRPC", ArgInt, ArgStr, ArgBool)
end

function LuaGameState:TestMulticastRPC(ArgInt, ArgStr, ArgBool)
    print("LuaGameState:TestMulticastRPC", ArgInt, ArgStr, ArgBool)
end

function LuaGameState:GetLifetimeReplicatedProps()
    local ELifetimeCondition = import("ELifetimeCondition")
    local FVectorType = import("Vector")
    return {
        { "Name", ELifetimeCondition.COND_InitialOnly, EPropertyClass.Str},
        { "HP", ELifetimeCondition.COND_OwnerOnly, EPropertyClass.Float},
        { "Position", ELifetimeCondition.COND_SimulatedOnly, FVectorType},
        { "TeamateNameList", ELifetimeCondition.COND_None, EPropertyClass.Array, EPropertyClass.Str},
        { "TeamatePositions", ELifetimeCondition.COND_None, EPropertyClass.Array, FVectorType},
        { "TeamatePositionsAlways", ELifetimeCondition.COND_None, EPropertyClass.Array, FVectorType, RepNotifyCondition = 1},
    }
end

function LuaGameState:ReceiveBeginPlay()
    self.bCanEverTick = true
    self.bCanBeDamaged = false
    print("LuaGameState:ReceiveBeginPlay")

    local KismetSystemLibrary = import("KismetSystemLibrary")
    if KismetSystemLibrary.IsDedicatedServer(self) then
        self:TestClientRPC(1, "TestClientRPC", false)
        self:TestMulticastRPC(2, "TestMulticastRPC", true)
    else
        self:TestServerRPC(3, "TestServerRPC", true)
    end

    self.Name = "Poli"
    self.Hp = 100
    self.Position.X = 100
    self.Position.Y = 200
    self.Position.Z = 300
    for i = 1, 5 do
        self.TeamateNameList:Add("Teamate"..i)
    end
end

function LuaGameState:OnRep_Name(OldName)
    print("LuaGameState:OnRep_Name: ", OldName, self.Name)
end

function LuaGameState:OnRep_HP(OldHP)
    print("LuaGameState:OnRep_HP: ", OldHP, self.HP)
end

function LuaGameState:OnRep_Position(OldPosition)
    local Position = self.Position
    print("LuaGameState:OnRep_Position: ", OldPosition.X, OldPosition.Y, OldPosition.Z, "New Position:", Position.X, Position.Y, Position.Z)
end

function LuaGameState:OnRep_TeamateNameList(OldNameList)
    print("LuaGameState:OnRep_TeamateNameList: ")
    for k, v in pairs(self.TeamateNameList) do
        print("Teamate:", k, v)
    end
end

function LuaGameState:OnRep_TeamatePositions()
    print("LuaGameState:OnRep_TeamatePositions: ")
    for k, v in pairs(self.TeamatePositions) do
        print("TeamatePositions: ", k, "Pos:", v.X, v.Y, v.Z)
    end
end

function LuaGameState:OnRep_TeamatePositionsAlways()
    print("LuaGameState:OnRep_TTeamatePositionsAlways: ")
    for k, v in pairs(self.TeamatePositionsAlways) do
        print("TeamatePositionsAlways: ", k, "Pos:", v.X, v.Y, v.Z)
    end
end

function LuaGameState:ReceiveTick()
    self.TickCounter = self.TickCounter + 1
    if self.TickCounter % 100 == 0  then
        print("LuaGameState::ReceiveTick TeamatePositionsAlways assign", self.TickCounter)
        self.TeamatePositionsAlways = self.TeamatePositions
    end
end

function LuaGameState:ReceiveEndPlay(reason)
    print("LuaGameState:ReceiveEndPlay")
end

return Class(nil, nil, LuaGameState)
