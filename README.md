# DOM Tracker Telegram Bot

A Cloudflare Workers-based Telegram bot that tracks website content changes using XPath selectors and notifies users when content changes.

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
yarn deploy
```

## Development

For local development:

```bash
yarn dev
```

### Debugging

Check Cloudflare Workers logs for error messages:

```bash
wrangler tail
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.
