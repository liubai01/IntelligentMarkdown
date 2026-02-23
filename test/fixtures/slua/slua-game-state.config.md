# slua-unreal LuaGameState Probe Fixture

This fixture demonstrates probe navigation patterns against `slua-game-state.lua`.

## Function path links

[Jump to ctor](probe://./slua-game-state.lua#LuaGameState.ctor)
[Jump to server RPC test](probe://./slua-game-state.lua#LuaGameState.TestServerRPC)
[Jump to begin play](probe://./slua-game-state.lua#LuaGameState.ReceiveBeginPlay)
[Jump to replicated props](probe://./slua-game-state.lua#LuaGameState.GetLifetimeReplicatedProps)
[Jump to HP replication handler](probe://./slua-game-state.lua#LuaGameState.OnRep_HP)

## Mermaid click links

```mermaid
flowchart TD
    A[ReceiveBeginPlay] --> B[TestServerRPC]
    A --> C[TestClientRPC]
    A --> D[TestMulticastRPC]

    click A "probe://./slua-game-state.lua#LuaGameState.ReceiveBeginPlay"
    click B "probe://./slua-game-state.lua#LuaGameState.TestServerRPC"
    click C "probe://./slua-game-state.lua#LuaGameState.TestClientRPC"
    click D "probe://./slua-game-state.lua#LuaGameState.TestMulticastRPC"
```
