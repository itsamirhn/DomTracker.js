# DOM Tracker Telegram Bot

A Cloudflare Workers-based Telegram bot that tracks website content changes using XPath selectors and notifies users when content changes.

## Features

- **Track Website Content**: Monitor specific elements on websites using XPath selectors
- **Change Notifications**: Get notified instantly when tracked content changes
- **Multiple Tracking**: Track multiple websites and elements simultaneously
- **User Management**: Each user has their own tracking list
- **Scheduled Checks**: Automatic content checking every 5 minutes
- **Database Storage**: Persistent storage using Cloudflare D1 database

## Commands

- `/start` - Start the bot and get welcome message
- `/add <url> <xpath> [label]` - Add a website to track
- `/list` - Show your tracked websites
- `/status` - Show latest content and update times
- `/delete <id>` - Remove a tracked website
- `/help` - Show help message

## Setup Instructions

### 1. Prerequisites

- Node.js and npm/yarn installed
- Cloudflare account
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### 2. Install Dependencies

```bash
yarn install
```

### 3. Create D1 Database

```bash
yarn db:create
```

This will create a D1 database and output the database ID. Copy this ID for the next step.

### 4. Configure Environment

1. Update `wrangler.jsonc`:
   - Replace `"database_id"` with your actual database ID

2. Set up secrets (required for security):

```bash
# Set your Telegram bot token
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter your bot token when prompted

# Set a secure webhook secret (generate a random string)
wrangler secret put WEBHOOK_SECRET
# Enter a random secret string (e.g., use: openssl rand -hex 32)
```

### 5. Run Database Migrations

```bash
# For local development
npm run db:migrate:local
# or
yarn db:migrate:local

# For production
npm run db:migrate
# or
yarn db:migrate
```

### 6. Set Up Telegram Webhook

After deployment, you'll need to set up the Telegram webhook with the secret:

```bash
# Replace <YOUR_BOT_TOKEN> with your actual bot token
# Replace <YOUR_WEBHOOK_SECRET> with the secret you set in step 4
# Replace <YOUR_WORKER_DOMAIN> with your actual worker domain

curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<YOUR_WORKER_DOMAIN>.workers.dev/webhook",
    "secret_token": "<YOUR_WEBHOOK_SECRET>"
  }'
```

The webhook secret adds an extra layer of security by ensuring only Telegram can send requests to your bot.

### 7. Deploy

```bash
npm run deploy
# or
yarn deploy
```

## Development

For local development:

```bash
npm run dev
# or
yarn dev
```

## XPath Examples

Here are some common XPath selectors you can use:

- `//h1` - All h1 elements
- `//div[@class='content']` - Div with class 'content'
- `//span[@id='price']` - Span with id 'price'
- `//a[@href]/text()` - Text content of all links
- `//p[contains(@class, 'description')]` - Paragraphs containing 'description' in class
- `//table//tr[2]/td[3]` - Third cell of second row in a table

## Usage Examples

### Add a price tracker

```
/add https://example-shop.com //span[@class='price'] "Product Price"
```

### Track a news headline

```
/add https://news-site.com //h1[@class='headline'] "Breaking News"
```

### Monitor a stock price

```
/add https://finance-site.com //div[@id='stock-price'] "AAPL Stock"
```

## Troubleshooting

### Common Issues

1. **Bot not responding**: Check if webhook is set up correctly with the secret
2. **401 Unauthorized errors**: Verify webhook secret is set and matches between bot and Telegram
3. **Database errors**: Ensure migrations are applied
4. **XPath not working**: Test XPath selector in browser developer tools
5. **Rate limiting**: Cloudflare Workers have request limits

### Debugging

Check Cloudflare Workers logs for error messages:

```bash
wrangler tail
```

## Security Notes

- Use Cloudflare secrets for sensitive data (bot token, webhook secret)
- Webhook secret validation prevents unauthorized requests
- The bot only tracks public websites
- XPath selectors are executed safely using xmldom
- Database queries use prepared statements to prevent SQL injection

## Limitations

- Cloudflare Workers have execution time limits
- Some websites may block automated requests
- JavaScript-rendered content may not be accessible
- XPath selectors must be valid XML/HTML paths

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.
