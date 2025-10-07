use anyhow::Result;
use tray_icon::Icon;

/// Get the default tray icon
pub fn get_tray_icon() -> Result<Icon> {
    // Create a simple 32x32 icon
    let icon_bytes = generate_icon_bytes(32, 32, [255, 140, 0, 255]); // Orange color
    Icon::from_rgba(icon_bytes, 32, 32).map_err(Into::into)
}

/// Get the locked state icon
pub fn get_locked_icon() -> Result<Icon> {
    // Red icon for locked state
    let icon_bytes = generate_icon_bytes(32, 32, [255, 0, 0, 255]); // Red
    Icon::from_rgba(icon_bytes, 32, 32).map_err(Into::into)
}

/// Get the unlocked state icon  
pub fn get_unlocked_icon() -> Result<Icon> {
    // Green icon for unlocked state
    let icon_bytes = generate_icon_bytes(32, 32, [0, 255, 0, 255]); // Green
    Icon::from_rgba(icon_bytes, 32, 32).map_err(Into::into)
}

/// Generate simple colored icon bytes
fn generate_icon_bytes(width: u32, height: u32, color: [u8; 4]) -> Vec<u8> {
    let mut icon_bytes = Vec::with_capacity((width * height * 4) as usize);
    
    for y in 0..height {
        for x in 0..width {
            // Create a circle shape
            let center_x = width / 2;
            let center_y = height / 2;
            let radius = width.min(height) / 2 - 2;
            
            let dx = x as i32 - center_x as i32;
            let dy = y as i32 - center_y as i32;
            let distance = ((dx * dx + dy * dy) as f32).sqrt();
            
            if distance <= radius as f32 {
                // Inside the circle - use the color
                icon_bytes.extend_from_slice(&color);
            } else {
                // Outside - transparent
                icon_bytes.extend_from_slice(&[0, 0, 0, 0]);
            }
        }
    }
    
    icon_bytes
}

#[cfg(target_os = "macos")]
pub fn setup_macos_app() {
    // macOS specific setup
    use cocoa::appkit::NSApp;
    use cocoa::appkit::NSApplication;
    use cocoa::appkit::NSApplicationActivationPolicy;
    
    unsafe {
        let app = NSApp();
        app.setActivationPolicy_(NSApplicationActivationPolicy::NSApplicationActivationPolicyAccessory);
    }
}