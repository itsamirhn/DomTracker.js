-- Create users table to store Telegram user information
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create tracking_items table to store websites being tracked
CREATE TABLE tracking_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    xpath TEXT NOT NULL,
    label TEXT,
    last_content TEXT,
    last_hash TEXT,
    last_checked DATETIME,
    last_updated DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for efficient lookups
CREATE INDEX idx_tracking_items_user_id ON tracking_items(user_id);
CREATE INDEX idx_tracking_items_active ON tracking_items(is_active);
CREATE INDEX idx_users_telegram_id ON users(telegram_id); 