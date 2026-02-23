-- Item Configuration Table
-- @config-md: ./items.config.md
-- Configures in-game item attributes

ItemsConfig = {
    -- Weapon List
    Weapons = {
        { id = 1001, name = "Wooden Sword", attack = 30, price = 50, stackable = false },
        { id = 1002, name = "Iron Sword", attack = 25, price = 200, stackable = true },
        { id = 1003, name = "Steel Sword", attack = 45, price = 500, stackable = true },
        { id = 1004, name = "Holy Blade", attack = 100, price = 2000, stackable = false },
        { id = 1005, name = "New Weapon", attack = 50, price = 100, stackable = true },
        { id = 1005, name = "New Weapon", attack = 50, price = 100, stackable = true },
        { id = 1005, name = "New Weapon", attack = 50, price = 100, stackable = false }
    },
    
    -- Potion List
    Potions = {
        { id = 2001, name = "Small Health Potion", effect = "heal", value = 50, price = 20, stackable = true },
        { id = 2002, name = "Medium Health Potion", effect = "heal", value = 150, price = 80, stackable = true },
        { id = 2003, name = "Large Health Potion", effect = "heal", value = 300, price = 200, stackable = true }
    }
}

return ItemsConfig
