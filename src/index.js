import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { CONFIG, MESSAGES, HTTP_STATUS } from './constants.js';

// Telegram Bot API helper functions
class TelegramBot {
	constructor(token) {
		this.token = token;
		this.baseUrl = `https://api.telegram.org/bot${token}`;
	}

	async sendMessage(chatId, text, options = {}) {
		const response = await fetch(`${this.baseUrl}/sendMessage`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chat_id: chatId,
				text: text,
				parse_mode: options.parse_mode || 'HTML',
				reply_markup: options.reply_markup,
				disable_web_page_preview: options.disable_web_page_preview !== false, // Default to true
				reply_to_message_id: options.reply_to_message_id,
			}),
		});
		return await response.json();
	}

	async getUpdates(offset = 0) {
		const response = await fetch(`${this.baseUrl}/getUpdates?offset=${offset}`);
		return await response.json();
	}
}

// Database helper functions
class DatabaseManager {
	constructor(db) {
		this.db = db;
	}

	async getOrCreateUser(telegramId, userData) {
		const stmt = this.db.prepare(`
			INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name)
			VALUES (?, ?, ?, ?)
		`);
		await stmt.bind(
			telegramId,
			userData.username || '',
			userData.first_name || '',
			userData.last_name || ''
		).run();

		const user = await this.db.prepare(`
			SELECT * FROM users WHERE telegram_id = ?
		`).bind(telegramId).first();

		return user;
	}

	async addTrackingItem(userId, url, xpath, label = null) {
		const stmt = this.db.prepare(`
			INSERT INTO tracking_items (user_id, url, xpath, label)
			VALUES (?, ?, ?, ?)
		`);
		const result = await stmt.bind(userId, url, xpath, label).run();
		return result.meta.last_row_id;
	}

	async getUserTrackingItems(userId) {
		const stmt = this.db.prepare(`
			SELECT * FROM tracking_items 
			WHERE user_id = ? AND is_active = 1
			ORDER BY created_at DESC
		`);
		const result = await stmt.bind(userId).all();
		return result.results;
	}

	async deleteTrackingItem(userId, itemId) {
		const stmt = this.db.prepare(`
			UPDATE tracking_items 
			SET is_active = 0 
			WHERE id = ? AND user_id = ?
		`);
		const result = await stmt.bind(itemId, userId).run();
		return result.meta.changes > 0;
	}

	async getAllActiveTrackingItems() {
		const stmt = this.db.prepare(`
			SELECT ti.*, u.telegram_id 
			FROM tracking_items ti
			JOIN users u ON ti.user_id = u.id
			WHERE ti.is_active = 1
		`);
		const result = await stmt.all();
		return result.results;
	}

	async updateTrackingItem(itemId, content, hash) {
		const stmt = this.db.prepare(`
			UPDATE tracking_items 
			SET last_content = ?, last_hash = ?, last_checked = CURRENT_TIMESTAMP, last_updated = CURRENT_TIMESTAMP
			WHERE id = ?
		`);
		await stmt.bind(content, hash, itemId).run();
	}

	async updateLastChecked(itemId) {
		const stmt = this.db.prepare(`
			UPDATE tracking_items 
			SET last_checked = CURRENT_TIMESTAMP
			WHERE id = ?
		`);
		await stmt.bind(itemId).run();
	}

	async getUserTrackingItemsCount(userId) {
		const stmt = this.db.prepare(`
			SELECT COUNT(*) as count
			FROM tracking_items 
			WHERE user_id = ? AND is_active = 1
		`);
		const result = await stmt.bind(userId).first();
		return result.count;
	}
}

// Timeout utility function
function withTimeout(promise, timeoutMs) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
		)
	]);
}

// Content extraction helper
class ContentExtractor {
	static async extractContent(url, xpathSelector) {
		try {
			const fetchPromise = fetch(url, {
				headers: {
					'User-Agent': CONFIG.USER_AGENT
				}
			});

			const response = await withTimeout(fetchPromise, CONFIG.REQUEST_TIMEOUT);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const html = await response.text();
			const parser = new DOMParser();

			// Try parsing as HTML first
			let document = parser.parseFromString(html, 'text/html');
			let nodes = xpath.select(xpathSelector, document);

			// If HTML parsing failed, try XML parsing
			if (!nodes || nodes.length === 0) {
				document = parser.parseFromString(html, 'application/xml');
				nodes = xpath.select(xpathSelector, document);
			}

			// If still no results, try selecting from documentElement
			if (!nodes || nodes.length === 0) {
				if (document.documentElement) {
					nodes = xpath.select(xpathSelector, document.documentElement);
				}
			}

			if (!nodes || nodes.length === 0) {
				return null;
			}

			// Extract text content from selected nodes
			const content = nodes.map(n => n.textContent?.trim() || '').filter(text => text.length > 0).join(' ');

			return content;
		} catch (error) {
			console.error('Error extracting content:', error);
			return null;
		}
	}

	static hashContent(content) {
		// Simple hash function for content comparison
		let hash = 0;
		if (content.length === 0) return hash;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString();
	}
}

// Command handlers
class CommandHandler {
	constructor(bot, dbManager) {
		this.bot = bot;
		this.dbManager = dbManager;
	}

	async handleStart(update, user) {
		const chatId = update.message.chat.id;
		const messageId = update.message.message_id;

		await this.dbManager.getOrCreateUser(user.id.toString(), user);
		await this.bot.sendMessage(chatId, MESSAGES.WELCOME, { reply_to_message_id: messageId });
	}

	async handleAdd(update, user) {
		const chatId = update.message.chat.id;
		const messageId = update.message.message_id;
		const text = update.message.text;
		const [command, ...args] = text.split(' ');

		const userData = await this.dbManager.getOrCreateUser(user.id.toString(), user);

		if (args.length < 2) {
			await this.bot.sendMessage(chatId, MESSAGES.ADD_INVALID_FORMAT, { reply_to_message_id: messageId });
			return;
		}

		// Check user limits
		const currentCount = await this.dbManager.getUserTrackingItemsCount(userData.id);
		if (currentCount >= CONFIG.MAX_TRACKING_ITEMS_PER_USER) {
			await this.bot.sendMessage(chatId, MESSAGES.ADD_LIMIT_REACHED(CONFIG.MAX_TRACKING_ITEMS_PER_USER), { reply_to_message_id: messageId });
			return;
		}

		const url = args[0];
		const xpathSelector = args[1];
		const label = args.slice(2).join(' ') || null;

		// Validate URL
		try {
			new URL(url);
		} catch (error) {
			await this.bot.sendMessage(chatId, MESSAGES.INVALID_URL, { reply_to_message_id: messageId });
			return;
		}

		// Test the XPath selector
		try {
			const content = await ContentExtractor.extractContent(url, xpathSelector);
			if (content === null) {
				await this.bot.sendMessage(chatId, MESSAGES.XPATH_FAILED, { reply_to_message_id: messageId });
				return;
			}

			const itemId = await this.dbManager.addTrackingItem(userData.id, url, xpathSelector, label);
			const hash = ContentExtractor.hashContent(content);
			await this.dbManager.updateTrackingItem(itemId, content, hash);

			await this.bot.sendMessage(chatId, MESSAGES.ADD_SUCCESS(url, xpathSelector, label, content), { reply_to_message_id: messageId });
		} catch (error) {
			console.error('Error adding tracking item:', error);
			if (error.message === 'Request timeout') {
				await this.bot.sendMessage(chatId, MESSAGES.REQUEST_TIMEOUT, { reply_to_message_id: messageId });
			} else {
				await this.bot.sendMessage(chatId, MESSAGES.ADD_ERROR, { reply_to_message_id: messageId });
			}
		}
	}

	async handleList(update, user) {
		const chatId = update.message.chat.id;
		const messageId = update.message.message_id;

		const userData = await this.dbManager.getOrCreateUser(user.id.toString(), user);
		const items = await this.dbManager.getUserTrackingItems(userData.id);

		if (items.length === 0) {
			await this.bot.sendMessage(chatId, MESSAGES.NO_TRACKING_ITEMS, { reply_to_message_id: messageId });
			return;
		}

		let message = MESSAGES.LIST_HEADER;
		items.forEach((item, index) => {
			const label = item.label || 'No label';
			const lastChecked = item.last_checked ?
				new Date(item.last_checked).toLocaleString() : 'Never';

			message += `<b>${index + 1}.</b> ${label}\n`;
			message += `🔗 ${item.url}\n`;
			message += `📍 XPath: <code>${item.xpath}</code>\n`;
			message += `🕐 Last checked: ${lastChecked}\n`;
			message += `🆔 ID: ${item.id}\n\n`;
		});

		await this.bot.sendMessage(chatId, message, { reply_to_message_id: messageId });
	}

	async handleStatus(update, user) {
		const chatId = update.message.chat.id;
		const messageId = update.message.message_id;

		const userData = await this.dbManager.getOrCreateUser(user.id.toString(), user);
		const items = await this.dbManager.getUserTrackingItems(userData.id);

		if (items.length === 0) {
			await this.bot.sendMessage(chatId, MESSAGES.NO_TRACKING_ITEMS, { reply_to_message_id: messageId });
			return;
		}

		let message = MESSAGES.STATUS_HEADER;
		items.forEach((item, index) => {
			const label = item.label || 'No label';
			const lastChecked = item.last_checked ?
				new Date(item.last_checked).toLocaleString() : 'Never';
			const lastUpdated = item.last_updated ?
				new Date(item.last_updated).toLocaleString() : 'Never';
			const content = item.last_content || 'No content yet';

			message += `<b>${index + 1}.</b> ${label}\n`;
			message += `🔗 ${item.url}\n`;
			message += `🕐 Last checked: ${lastChecked}\n`;
			message += `🔄 Last updated: ${lastUpdated}\n`;
			message += `📄 Content: ${content.substring(0, 150)}${content.length > 150 ? '...' : ''}\n\n`;
		});

		await this.bot.sendMessage(chatId, message, { reply_to_message_id: messageId });
	}

	async handleDelete(update, user) {
		const chatId = update.message.chat.id;
		const messageId = update.message.message_id;
		const text = update.message.text;
		const [command, ...args] = text.split(' ');

		const userData = await this.dbManager.getOrCreateUser(user.id.toString(), user);

		if (args.length === 0) {
			await this.bot.sendMessage(chatId, MESSAGES.DELETE_INVALID_FORMAT, { reply_to_message_id: messageId });
			return;
		}

		const itemId = parseInt(args[0]);
		if (isNaN(itemId)) {
			await this.bot.sendMessage(chatId, MESSAGES.DELETE_INVALID_ID, { reply_to_message_id: messageId });
			return;
		}

		const success = await this.dbManager.deleteTrackingItem(userData.id, itemId);
		if (success) {
			await this.bot.sendMessage(chatId, MESSAGES.DELETE_SUCCESS, { reply_to_message_id: messageId });
		} else {
			await this.bot.sendMessage(chatId, MESSAGES.DELETE_NOT_FOUND, { reply_to_message_id: messageId });
		}
	}

	async handleHelp(update) {
		const chatId = update.message.chat.id;
		const messageId = update.message.message_id;

		await this.bot.sendMessage(chatId, MESSAGES.HELP, { reply_to_message_id: messageId });
	}
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// Handle Telegram webhook
		if (request.method === 'POST' && url.pathname === '/webhook') {
			// Validate webhook secret
			const webhookSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
			if (!webhookSecret || webhookSecret !== env.WEBHOOK_SECRET) {
				console.error('Invalid webhook secret');
				return new Response('Unauthorized', { status: HTTP_STATUS.UNAUTHORIZED });
			}

			const update = await request.json();
			await handleTelegramUpdate(update, env);
			return new Response('OK');
		}

		// Handle test scheduled endpoint
		if (url.pathname === '/__scheduled') {
			await handleScheduledCheck(env);
			return new Response('Scheduled check completed');
		}

		return new Response('DOM Tracker Bot is running!');
	},

	async scheduled(event, env, ctx) {
		// Handle the scheduled cron job
		ctx.waitUntil(handleScheduledCheck(env));
	},
};

async function handleTelegramUpdate(update, env) {
	if (!update.message) return;

	const message = update.message;
	const user = message.from;
	const text = message.text;

	if (!text || !text.startsWith('/')) return;

	const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN);
	const dbManager = new DatabaseManager(env.DB);
	const commandHandler = new CommandHandler(bot, dbManager);

	const [command, ...args] = text.split(' ');

	try {
		switch (command) {
			case '/start':
				await commandHandler.handleStart(update, user);
				break;
			case '/add':
				await commandHandler.handleAdd(update, user);
				break;
			case '/list':
				await commandHandler.handleList(update, user);
				break;
			case '/status':
				await commandHandler.handleStatus(update, user);
				break;
			case '/delete':
				await commandHandler.handleDelete(update, user);
				break;
			case '/help':
				await commandHandler.handleHelp(update);
				break;
			default:
				const chatId = message.chat.id;
				const messageId = message.message_id;
				await bot.sendMessage(chatId, MESSAGES.UNKNOWN_COMMAND, { reply_to_message_id: messageId });
		}
	} catch (error) {
		console.error('Error handling command:', error);
		const chatId = message.chat.id;
		const messageId = message.message_id;
		await bot.sendMessage(chatId, MESSAGES.GENERAL_ERROR, { reply_to_message_id: messageId });
	}
}

async function handleScheduledCheck(env) {
	const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN);
	const dbManager = new DatabaseManager(env.DB);

	try {
		const items = await dbManager.getAllActiveTrackingItems();

		for (const item of items) {
			try {
				const content = await ContentExtractor.extractContent(item.url, item.xpath);

				if (content === null) {
					await dbManager.updateLastChecked(item.id);
					continue;
				}

				const newHash = ContentExtractor.hashContent(content);

				// Check if content changed
				if (item.last_hash && item.last_hash !== newHash) {
					// Content changed, notify user
					const label = item.label || 'Tracked Website';
					const message = MESSAGES.CONTENT_CHANGED(label, item.url, item.xpath, item.last_content, content);

					await bot.sendMessage(item.telegram_id, message);
				}

				// Update the database
				await dbManager.updateTrackingItem(item.id, content, newHash);

			} catch (error) {
				console.error(`Error checking item ${item.id}:`, error);
				await dbManager.updateLastChecked(item.id);
			}
		}

		console.log(`Checked ${items.length} tracking items`);
	} catch (error) {
		console.error('Error in scheduled check:', error);
	}
}
