-- Installation Configuration
-- This file stores installation settings for the config.md extension

InstallConfig = {
    -- Current version
    Version = "0.5.4",
    
    -- Installation settings
    Settings = {
        -- Auto-reload window after installation
        AutoReload = true,
        
        -- Force reinstall if extension exists
        ForceReinstall = true,
        
        -- Clean old versions before install
        CleanOldVersions = true,
        
        -- Build mode: "production" or "development"
        BuildMode = "production"
    },
    
    -- Installation status
    Status = {
        -- Last installation timestamp
        LastInstalled = nil,
        
        -- Installation success status
        Success = false,
        
        -- Error message if installation failed
        Error = nil
    }
}

return InstallConfig
