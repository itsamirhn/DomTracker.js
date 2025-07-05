// Configuration constants
export const CONFIG = {
    // Request timeout in milliseconds (30 seconds)
    REQUEST_TIMEOUT: 5000,

    // User limits
    MAX_TRACKING_ITEMS_PER_USER: 5,

    // User agent for web requests
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// Bot messages
export const MESSAGES = {
    WELCOME: `
🤖 <b>Welcome to DOM Tracker Bot!</b>

I can help you track changes on websites using XPath selectors.

<b>Available commands:</b>
/add - Add a new website to track
/list - Show your tracked websites
/status - Show latest content and update times
/delete - Remove a tracked website
/help - Show this help message

<b>How to use:</b>
1. Use /add to add a website with XPath selector
2. I'll check for changes every 5 minutes
3. You'll get notified when content changes

<b>Example:</b>
/add https://example.com //h1[@class='title'] "Page Title"
	`,

    HELP: `
🤖 <b>DOM Tracker Bot Help</b>

<b>Commands:</b>
/start - Start the bot and get welcome message
/add &lt;url&gt; &lt;xpath&gt; [label] - Add website to track
/list - Show your tracked websites
/status - Show latest content and update times
/delete &lt;id&gt; - Remove tracked website
/help - Show this help message

<b>XPath Examples:</b>
• //h1 - All h1 elements
• //div[@class='content'] - Div with class 'content'
• //span[@id='price'] - Span with id 'price'
• //a[@href]/text() - Text of all links

<b>Usage Example:</b>
/add https://example.com //h1[@class='title'] "Page Title"

The bot checks for changes every 5 minutes and notifies you when content changes.
	`,

    ADD_INVALID_FORMAT: `
❌ <b>Invalid format!</b>

Usage: /add &lt;url&gt; &lt;xpath&gt; [label]

<b>Example:</b>
/add https://example.com //h1[@class='title'] "Page Title"
	`,

    ADD_SUCCESS: (url, xpath, label, content) => `
✅ <b>Successfully added tracking item!</b>

<b>URL:</b> ${url}
<b>XPath:</b> <code>${xpath}</code>
<b>Label:</b> ${label || 'No label'}
<b>Current content:</b> ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}
	`,

    ADD_LIMIT_REACHED: (limit) => `
❌ <b>Limit reached!</b>

You can track at most ${limit} websites. Please delete some tracking items first using /delete command.

Use /list to see your current tracking items.
	`,

    INVALID_URL: '❌ Invalid URL format!',
    XPATH_FAILED: '❌ Could not extract content with the provided XPath selector. Please check the URL and XPath.',
    ADD_ERROR: '❌ Error adding tracking item. Please try again.',
    REQUEST_TIMEOUT: '❌ Request timed out. Please try again with a different URL.',

    DELETE_INVALID_FORMAT: `
❌ <b>Please provide the ID of the item to delete.</b>

Usage: /delete &lt;id&gt;

Use /list to see your tracked websites with their IDs.
	`,

    DELETE_INVALID_ID: '❌ Invalid ID format! Please provide a numeric ID.',
    DELETE_SUCCESS: '✅ Successfully deleted the tracking item!',
    DELETE_NOT_FOUND: '❌ Could not find the tracking item with that ID.',

    NO_TRACKING_ITEMS: '📋 You have no tracked websites yet. Use /add to start tracking!',

    LIST_HEADER: '📋 <b>Your tracked websites:</b>\n\n',

    STATUS_HEADER: '📊 <b>Status of your tracked websites:</b>\n\n',

    UNKNOWN_COMMAND: '❌ Unknown command. Use /help to see available commands.',
    GENERAL_ERROR: '❌ An error occurred while processing your request.',

    CONTENT_CHANGED: (label, url, xpath, oldContent, newContent) => `
🔔 <b>Content Changed!</b>

<b>Website:</b> ${label}
<b>URL:</b> ${url}
<b>XPath:</b> <code>${xpath}</code>

<b>Previous content:</b>
${oldContent || 'No previous content'}

<b>New content:</b>
${newContent}

<b>Updated:</b> ${new Date().toLocaleString()}
	`
};

// HTTP status codes
export const HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
}; 