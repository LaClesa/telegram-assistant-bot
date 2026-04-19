import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, PageBreak, TableOfContents, StyleLevel,
  LevelFormat, UnderlineType, ShadingType,
} from 'docx';
import { writeFileSync } from 'fs';

// ─── Colour palette ────────────────────────────────────────────────────────
const BLUE       = '1E3A5F';
const LIGHT_BLUE = 'EBF3FB';
const GREEN      = '1A7340';
const GREY_BG    = 'F2F2F2';
const CODE_BG    = 'F0F4F8';
const WHITE      = 'FFFFFF';
const BORDER_CLR = 'C5D5E8';

// ─── Helpers ───────────────────────────────────────────────────────────────

const h1 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 200 },
  border: { bottom: { color: BLUE, size: 8, style: BorderStyle.SINGLE } },
});

const h2 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 320, after: 120 },
});

const h3 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 80 },
});

const p = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: 22, ...opts })],
  spacing: { before: 60, after: 60 },
});

const bold = (text) => new TextRun({ text, bold: true, size: 22 });
const normal = (text) => new TextRun({ text, size: 22 });

const pMixed = (...runs) => new Paragraph({
  children: runs,
  spacing: { before: 60, after: 60 },
});

const bullet = (text, level = 0) => new Paragraph({
  children: [new TextRun({ text, size: 22 })],
  bullet: { level },
  spacing: { before: 40, after: 40 },
});

const bulletMixed = (runs, level = 0) => new Paragraph({
  children: runs,
  bullet: { level },
  spacing: { before: 40, after: 40 },
});

const code = (text) => new Paragraph({
  children: [new TextRun({ text, font: 'Courier New', size: 20, color: '2D3748' })],
  shading: { type: ShadingType.SOLID, color: CODE_BG },
  spacing: { before: 80, after: 80 },
  indent: { left: 360 },
});

const spacer = () => new Paragraph({ text: '', spacing: { before: 100, after: 100 } });

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const infoBox = (lines) => {
  const children = lines.flatMap((line, i) => [
    new TextRun({ text: line, size: 21, color: '1A365D' }),
    ...(i < lines.length - 1 ? [new TextRun({ text: '\n', size: 21 })] : []),
  ]);
  return new Paragraph({
    children,
    shading: { type: ShadingType.SOLID, color: LIGHT_BLUE },
    border: {
      left:  { color: BLUE, size: 12, style: BorderStyle.SINGLE },
      top:   { color: BORDER_CLR, size: 4, style: BorderStyle.SINGLE },
      right: { color: BORDER_CLR, size: 4, style: BorderStyle.SINGLE },
      bottom:{ color: BORDER_CLR, size: 4, style: BorderStyle.SINGLE },
    },
    indent: { left: 220, right: 220 },
    spacing: { before: 120, after: 120 },
  });
};

const tableCell = (text, header = false, width = null) => new TableCell({
  children: [new Paragraph({
    children: [new TextRun({ text, bold: header, size: header ? 21 : 20, color: header ? WHITE : '000000' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 60 },
  })],
  shading: header ? { type: ShadingType.SOLID, color: BLUE } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
});

const simpleTable = (headers, rows, colWidths = null) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      children: headers.map((h, i) => tableCell(h, true, colWidths?.[i])),
      tableHeader: true,
    }),
    ...rows.map((row, ri) => new TableRow({
      children: row.map((cell, i) => {
        const tc = new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: cell, size: 20 })],
            spacing: { before: 60, after: 60 },
          })],
          shading: ri % 2 === 1 ? { type: ShadingType.SOLID, color: GREY_BG } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          ...(colWidths?.[i] ? { width: { size: colWidths[i], type: WidthType.PERCENTAGE } } : {}),
        });
        return tc;
      }),
    })),
  ],
});

// ─── Cover page ────────────────────────────────────────────────────────────

const coverPage = [
  new Paragraph({ text: '', spacing: { before: 1200 } }),
  new Paragraph({
    children: [new TextRun({ text: 'AI-Powered Telegram Assistant Bot', bold: true, size: 52, color: BLUE })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Complete Documentation & User Guide', size: 30, color: '444444' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
  }),
  new Paragraph({
    shading: { type: ShadingType.SOLID, color: BLUE },
    border: { bottom: { color: BLUE, size: 20, style: BorderStyle.SINGLE } },
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: ' ', size: 10 })],
  }),
  new Paragraph({ text: '', spacing: { before: 400, after: 0 } }),
  new Paragraph({
    children: [new TextRun({ text: 'Built with NestJS · Claude Sonnet 4.6 · PostgreSQL · Redis', size: 21, color: '666666' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Version 1.0  ·  April 2026', size: 21, color: '888888' })],
    alignment: AlignmentType.CENTER,
  }),
  pageBreak(),
];

// ─── Document sections ─────────────────────────────────────────────────────

const sections = [

  // ── 1. Introduction ──────────────────────────────────────────────────────
  h1('1. Introduction'),
  p('The AI-Powered Telegram Assistant Bot is a professional personal assistant integrated into Telegram. It combines the conversational intelligence of Claude Sonnet 4.6 (Anthropic\'s latest AI model) with practical tools: file analysis, Google Workspace integration, persistent memory, and full group chat support.'),
  spacer(),
  h2('1.1  Key Capabilities'),
  bullet('Natural language AI conversation with full context awareness'),
  bullet('Image, PDF, CSV, Excel, and code file analysis'),
  bullet('Google Docs, Sheets, and Drive read/write integration'),
  bullet('Persistent short-term (Redis) and long-term (PostgreSQL) memory'),
  bullet('Conversation auto-summarisation to manage context costs'),
  bullet('Per-user permission consent system (7 scopes)'),
  bullet('Group chat participation with @mention detection'),
  bullet('Per-user message rate limiting'),
  bullet('Production-ready Docker deployment'),
  spacer(),
  infoBox([
    '💡  The bot is privacy-first: it asks your explicit permission before accessing',
    '    files, messaging others, running code, or storing long-term memory.',
  ]),
  pageBreak(),

  // ── 2. Getting Started ──────────────────────────────────────────────────
  h1('2. Getting Started'),
  h2('2.1  Prerequisites'),
  simpleTable(
    ['Requirement', 'Version', 'Purpose'],
    [
      ['Node.js', '≥ 20', 'Runtime'],
      ['Docker + Docker Compose', 'Any recent', 'PostgreSQL + Redis'],
      ['Telegram Bot Token', '—', 'From @BotFather'],
      ['Anthropic API Key', '—', 'From console.anthropic.com'],
      ['Google OAuth Credentials', 'Optional', 'For Google Workspace features'],
    ],
    [35, 20, 45],
  ),
  spacer(),
  h2('2.2  Installation'),
  p('Clone or download the project, then run:'),
  code('# Install dependencies'),
  code('npm install'),
  code(''),
  code('# Copy the environment template'),
  code('cp .env.example .env'),
  spacer(),
  h2('2.3  Configuration'),
  p('Open .env and fill in each value:'),
  spacer(),
  simpleTable(
    ['Variable', 'Required', 'Description'],
    [
      ['TELEGRAM_BOT_TOKEN', 'Yes', 'Your bot token from @BotFather'],
      ['ANTHROPIC_API_KEY', 'Yes', 'API key from console.anthropic.com'],
      ['DATABASE_URL', 'Yes', 'PostgreSQL connection string'],
      ['REDIS_URL', 'Yes', 'Redis connection string'],
      ['GOOGLE_CLIENT_ID', 'No*', 'Google OAuth client ID'],
      ['GOOGLE_CLIENT_SECRET', 'No*', 'Google OAuth client secret'],
      ['GOOGLE_CALLBACK_URL', 'No*', 'OAuth redirect URL (your public URL + /auth/google/callback)'],
      ['TOKEN_ENCRYPTION_KEY', 'No*', '64 hex chars for AES-256-GCM token encryption'],
      ['WEBHOOK_URL', 'No', 'Your public HTTPS URL for webhook mode (leave empty for long polling)'],
      ['RATE_LIMIT_PER_MINUTE', 'No', 'Max messages per user per minute (default: 20)'],
      ['NODE_ENV', 'No', 'Set to production in production'],
    ],
    [35, 12, 53],
  ),
  spacer(),
  p('* Required only if you want Google Workspace features.'),
  spacer(),
  infoBox([
    '🔑  To generate TOKEN_ENCRYPTION_KEY, run:',
    '    openssl rand -hex 32',
  ]),
  spacer(),
  h2('2.4  Starting the Bot'),
  h3('Development (long polling)'),
  code('# Start PostgreSQL and Redis'),
  code('docker-compose up -d'),
  code(''),
  code('# Start the bot in watch mode'),
  code('npm run start:dev'),
  spacer(),
  h3('Production (Docker)'),
  code('# Build and start all services'),
  code('docker-compose -f docker-compose.prod.yml up -d --build'),
  code(''),
  code('# Check health'),
  code('curl http://localhost:3000/health'),
  spacer(),
  infoBox([
    '✅  When running, open Telegram and send /start to your bot.',
    '    The bot will greet you and create your user profile.',
  ]),
  pageBreak(),

  // ── 3. Commands Reference ────────────────────────────────────────────────
  h1('3. Commands Reference'),
  h2('3.1  Private Chat Commands'),
  simpleTable(
    ['Command', 'Description'],
    [
      ['/start', 'Greet the bot and create your user profile'],
      ['/help', 'Show the full help menu with supported features'],
      ['/permissions', 'View all permission scopes and their current grant status'],
      ['/forget', 'Clear your current Redis session (start a fresh conversation)'],
      ['/connect', 'Link your Google account via OAuth 2.0'],
      ['/disconnect', 'Unlink your Google account and delete stored tokens'],
      ['/gdoc <url> [instruction]', 'Read a Google Doc; optionally ask a question or give an edit instruction'],
      ['/gsheet <url> [range] [instruction]', 'Read a Google Sheet; optionally specify a cell range'],
      ['/gdrive [query or file-id]', 'List recent Drive files, search by name, or analyse a file by ID'],
    ],
    [40, 60],
  ),
  spacer(),
  h2('3.2  Group Chat Commands'),
  p('These commands are only available in group and supergroup chats. Admin commands require the user to be a Telegram group administrator.'),
  spacer(),
  simpleTable(
    ['Command', 'Who can use', 'Description'],
    [
      ['/enable', 'Group admin', 'Enable the bot in this group'],
      ['/disable', 'Group admin', 'Disable the bot in this group (it will stop responding)'],
      ['/groupsettings', 'Anyone', 'Show current group bot configuration and session size'],
    ],
    [35, 20, 45],
  ),
  pageBreak(),

  // ── 4. Conversational AI ────────────────────────────────────────────────
  h1('4. Conversational AI'),
  h2('4.1  Chatting in Private'),
  p('Simply send any message to the bot and it will respond. The bot maintains full context across your conversation:'),
  bullet('References like "that document", "the code above", or "my last task" are understood'),
  bullet('Preferences you mention (e.g. "always reply in bullet points") are remembered'),
  bullet('Conversation history is kept in Redis for 2 hours per session'),
  bullet('After a session ends, a summary is stored in the database for future reference'),
  spacer(),
  h2('4.2  Memory System'),
  simpleTable(
    ['Layer', 'Storage', 'Capacity', 'Duration'],
    [
      ['Active session', 'Redis', '50 messages', '2 hours'],
      ['Auto-summary', 'PostgreSQL', 'Condensed text', 'Permanent'],
      ['Full history', 'PostgreSQL', 'Last 100 messages', 'Permanent'],
    ],
    [25, 20, 25, 30],
  ),
  spacer(),
  infoBox([
    '🧠  When your session reaches 30 messages, the bot automatically summarises',
    '    the conversation using AI and resets the session to the last 5 messages.',
    '    The summary is injected as context on your next conversation.',
  ]),
  spacer(),
  h2('4.3  Permission System'),
  p('Before performing sensitive actions, the bot asks your explicit consent. Once granted, permissions persist until you revoke them.'),
  spacer(),
  simpleTable(
    ['Permission Scope', 'What it allows'],
    [
      ['GROUP_ACCESS', 'Bot participates in group chats'],
      ['MESSAGING', 'Bot sends messages to other users on your behalf'],
      ['FILE_ACCESS', 'Bot accesses local or cloud files'],
      ['API_ACCESS', 'Bot connects to external APIs or services'],
      ['DOCUMENT_MODIFY', 'Bot edits documents (Google Docs, Sheets, etc.)'],
      ['RUN_CODE', 'Bot executes code or scripts'],
      ['LONG_TERM_MEMORY', 'Bot stores information in long-term memory'],
    ],
    [35, 65],
  ),
  spacer(),
  p('To view or revoke permissions, use:'),
  code('/permissions'),
  pageBreak(),

  // ── 5. File Analysis ────────────────────────────────────────────────────
  h1('5. File Analysis'),
  p('Send any supported file directly in the chat. You can include a caption — the caption becomes your question or instruction to the AI.'),
  spacer(),
  h2('5.1  Supported File Types'),
  simpleTable(
    ['Type', 'Formats', 'How to send', 'What the bot does'],
    [
      ['Images', 'JPEG, PNG, GIF, WebP', 'Tap 📎 → Photo/Video', 'Claude visually analyses the image'],
      ['PDF', '.pdf', 'Tap 📎 → File', 'Extracts text (up to 40,000 chars), summarises'],
      ['CSV', '.csv', 'Tap 📎 → File', 'Parses into markdown table (up to 200 rows)'],
      ['Excel', '.xlsx, .xls, .ods', 'Tap 📎 → File', 'Parses all sheets, renders as tables'],
      ['Text/Code', '.txt .py .ts .js .go .json .yaml etc.', 'Tap 📎 → File', 'Reads file and analyses code or text'],
    ],
    [12, 25, 25, 38],
  ),
  spacer(),
  h2('5.2  Usage Examples'),
  pMixed(bold('Analyse an image: '), normal('Send a photo → bot describes content, extracts text if present')),
  pMixed(bold('Ask about a PDF: '), normal('Send PDF with caption "What are the main conclusions?" → AI answers from the document')),
  pMixed(bold('Review code: '), normal('Send a .py file with caption "Review this for bugs" → AI reviews it')),
  pMixed(bold('Summarise data: '), normal('Send a CSV with caption "Which product had the highest sales?" → AI queries the data')),
  spacer(),
  infoBox([
    '📏  Files larger than 5 MB will show a brief warning before processing.',
    '    Maximum file size is 20 MB (Telegram\'s bot API limit).',
  ]),
  pageBreak(),

  // ── 6. Google Workspace ─────────────────────────────────────────────────
  h1('6. Google Workspace Integration'),
  h2('6.1  Setting Up Google OAuth'),
  p('Before using Google Workspace features, you need to:'),
  bullet('Set up a Google Cloud project and enable the Drive, Docs, and Sheets APIs'),
  bullet('Create OAuth 2.0 credentials (Web application type)'),
  bullet('Add your callback URL to the authorised redirect URIs'),
  bullet('Copy GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to .env'),
  spacer(),
  h3('For local development with ngrok:'),
  code('# Start ngrok on port 3000'),
  code('ngrok http 3000'),
  code(''),
  code('# Copy the HTTPS URL to .env, e.g.:'),
  code('GOOGLE_CALLBACK_URL=https://abc123.ngrok.io/auth/google/callback'),
  spacer(),
  h2('6.2  Connecting Your Account'),
  p('In Telegram, send:'),
  code('/connect'),
  p('The bot will send you an authorisation link. Click it, sign into your Google account, and grant the requested permissions. You\'ll see a success page and receive a confirmation message in Telegram.'),
  spacer(),
  infoBox([
    '🔒  Your OAuth tokens are encrypted at rest using AES-256-GCM before being',
    '    stored in PostgreSQL. Tokens are automatically refreshed when they expire.',
  ]),
  spacer(),
  h2('6.3  Google Docs'),
  simpleTable(
    ['Example command', 'What happens'],
    [
      ['/gdoc https://docs.google.com/document/d/ID/edit', 'Bot reads and summarises the document'],
      ['/gdoc https://docs.google.com/... What is the main argument?', 'Bot answers your question about the document'],
      ['/gdoc https://docs.google.com/... Add a conclusion paragraph about sustainability', 'Bot writes content and appends it to the document (requires DOCUMENT_MODIFY permission)'],
    ],
    [50, 50],
  ),
  spacer(),
  h2('6.4  Google Sheets'),
  simpleTable(
    ['Example command', 'What happens'],
    [
      ['/gsheet https://docs.google.com/spreadsheets/d/ID/edit', 'Bot reads Sheet1 and displays the data'],
      ['/gsheet https://docs.google.com/... Sheet2!A1:F50', 'Bot reads the specified range from Sheet2'],
      ['/gsheet https://docs.google.com/... Which rows have sales > 10000?', 'Bot analyses the data and answers your question'],
    ],
    [50, 50],
  ),
  spacer(),
  h2('6.5  Google Drive'),
  simpleTable(
    ['Example command', 'What happens'],
    [
      ['/gdrive', 'Lists your 20 most recently modified files'],
      ['/gdrive quarterly report', 'Searches Drive for files matching "quarterly report"'],
      ['/gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', 'Downloads and analyses the file with that ID'],
    ],
    [50, 50],
  ),
  spacer(),
  h2('6.6  Disconnecting'),
  p('To revoke access and delete stored tokens:'),
  code('/disconnect'),
  pageBreak(),

  // ── 7. Group Chat ────────────────────────────────────────────────────────
  h1('7. Group Chat'),
  h2('7.1  Adding the Bot to a Group'),
  bullet('Open your Telegram group → tap the group name → Add Members'),
  bullet('Search for your bot by username and add it'),
  bullet('The bot automatically registers the group in its database'),
  bullet('The bot is enabled by default and starts listening for @mentions'),
  spacer(),
  h2('7.2  Interacting in a Group'),
  p('The bot only responds in group chats when it is directly addressed. There are two ways:'),
  spacer(),
  pMixed(bold('1. @mention:  '), normal('Type @yourBotName followed by your message')),
  code('@assistantbot What is the capital of Malaysia?'),
  spacer(),
  pMixed(bold('2. Reply to the bot:  '), normal('Tap "Reply" on any of the bot\'s messages and send your response')),
  spacer(),
  infoBox([
    '👥  The bot tracks the group conversation context and attributes each message',
    '    to the sender by first name. Claude knows who said what.',
  ]),
  spacer(),
  h2('7.3  Group Memory'),
  p('Groups have their own shared conversation session (separate from all users\' private sessions):'),
  bullet('Session key: group:{chatId} — isolated from private chats'),
  bullet('Session TTL: 2 hours of inactivity'),
  bullet('Auto-summarisation: triggers at 30 group messages'),
  bullet('Rate limit: 30 messages per minute across the whole group'),
  spacer(),
  h2('7.4  Admin Controls'),
  simpleTable(
    ['Command', 'Effect'],
    [
      ['/disable', 'Bot stops responding to @mentions in this group. Useful during meetings or off-hours.'],
      ['/enable', 'Re-enables the bot after it was disabled.'],
      ['/groupsettings', 'Shows the group name, enabled status, and current session message count.'],
    ],
    [20, 80],
  ),
  spacer(),
  infoBox([
    '⚠️  Permission-sensitive actions (file access, Google Workspace, etc.) are',
    '    not available in group chats. Ask users to message the bot privately',
    '    for those features.',
  ]),
  pageBreak(),

  // ── 8. Rate Limiting ────────────────────────────────────────────────────
  h1('8. Rate Limiting & Safety'),
  h2('8.1  Message Rate Limits'),
  simpleTable(
    ['Context', 'Default limit', 'Window', 'Configurable via'],
    [
      ['Private chat', '20 messages', '60 seconds', 'RATE_LIMIT_PER_MINUTE env var'],
      ['Group chat', '30 messages', '60 seconds', 'Hardcoded in group.update.ts'],
    ],
    [25, 20, 20, 35],
  ),
  spacer(),
  p('When the limit is exceeded the bot replies once with a cool-down notice and ignores subsequent messages until the 60-second window resets.'),
  spacer(),
  h2('8.2  Data Security'),
  bullet('Google OAuth tokens are encrypted at rest with AES-256-GCM using a 32-byte key'),
  bullet('The encryption key (TOKEN_ENCRYPTION_KEY) must never be committed to version control'),
  bullet('All database connections use environment variables — no hardcoded credentials'),
  bullet('The Docker production image runs as a non-root user'),
  spacer(),
  h2('8.3  Health Check'),
  p('The bot exposes a health check endpoint for monitoring and container orchestration:'),
  code('GET /health'),
  spacer(),
  p('Response (200 OK when healthy):'),
  code('{ "status": "ok", "db": "ok", "redis": "ok", "uptime": 3600 }'),
  spacer(),
  p('Response (503 Service Unavailable when degraded):'),
  code('{ "status": "degraded", "db": "error", "redis": "ok", "uptime": 720 }'),
  pageBreak(),

  // ── 9. Production Deployment ─────────────────────────────────────────────
  h1('9. Production Deployment'),
  h2('9.1  Docker Deployment'),
  p('The project includes a multi-stage Dockerfile and a production Compose file:'),
  code('# Build and start all services in detached mode'),
  code('docker-compose -f docker-compose.prod.yml up -d --build'),
  code(''),
  code('# Verify health'),
  code('curl http://localhost:3000/health'),
  code(''),
  code('# View logs'),
  code('docker-compose -f docker-compose.prod.yml logs -f app'),
  spacer(),
  h2('9.2  Webhook vs Long Polling'),
  simpleTable(
    ['Mode', 'When to use', 'Config'],
    [
      ['Long polling (default)', 'Local development — no public URL required', 'Leave WEBHOOK_URL empty'],
      ['Webhook', 'Production — faster, more efficient', 'Set WEBHOOK_URL to your public HTTPS URL'],
    ],
    [25, 45, 30],
  ),
  spacer(),
  p('When WEBHOOK_URL is set, Telegram will POST updates to:'),
  code('POST https://yourdomain.com/telegram-webhook'),
  spacer(),
  infoBox([
    '🔐  Telegram requires HTTPS for webhooks. Use a reverse proxy (nginx, Caddy)',
    '    with a valid TLS certificate (e.g. from Let\'s Encrypt).',
  ]),
  spacer(),
  h2('9.3  Environment Checklist'),
  bullet('TELEGRAM_BOT_TOKEN — set and valid'),
  bullet('ANTHROPIC_API_KEY — set and valid'),
  bullet('DATABASE_URL — pointing to production PostgreSQL'),
  bullet('REDIS_URL — pointing to production Redis'),
  bullet('TOKEN_ENCRYPTION_KEY — 64 hex chars, stored securely (not in code)'),
  bullet('WEBHOOK_URL — set to your public HTTPS domain'),
  bullet('NODE_ENV=production'),
  bullet('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL — if using Google features'),
  pageBreak(),

  // ── 10. Architecture ─────────────────────────────────────────────────────
  h1('10. Architecture Overview'),
  h2('10.1  Module Structure'),
  simpleTable(
    ['Module', 'Responsibility'],
    [
      ['TelegramModule', 'Handles all private chat interactions (text, photo, document, commands)'],
      ['GroupsModule', 'Group chat participation, @mention detection, admin controls'],
      ['AIModule', 'Claude Sonnet 4.6 API wrapper with prompt caching and summarisation'],
      ['MemoryModule', 'Redis short-term session + PostgreSQL long-term memory + auto-summarise'],
      ['PermissionsModule', 'Per-user consent system with 7 scopes stored in PostgreSQL'],
      ['FilesModule', 'Downloads files from Telegram; routes to image/PDF/CSV/Excel/text extractors'],
      ['GoogleModule', 'OAuth 2.0 flow, Google Docs/Sheets/Drive API wrappers, token encryption'],
      ['DatabaseModule', 'TypeORM configuration, entities, PostgreSQL connection'],
      ['HealthModule', 'GET /health endpoint — checks DB and Redis connectivity'],
    ],
    [28, 72],
  ),
  spacer(),
  h2('10.2  Data Flow'),
  p('A typical private chat message follows this path:'),
  spacer(),
  bullet('User sends message → Telegraf receives update → TelegramUpdate.onMessage()'),
  bullet('Rate limit check → Redis INCR counter'),
  bullet('Pending permission check → Redis lookup'),
  bullet('Context build → Redis session + PostgreSQL summary merged'),
  bullet('AI call → Anthropic Claude Sonnet 4.6 API with cached system prompt'),
  bullet('Permission signal detection → [PERMISSION_REQUIRED: SCOPE] pattern'),
  bullet('Save exchange → Redis session + PostgreSQL history'),
  bullet('Auto-summarise check → if ≥ 30 messages, summarise and reset'),
  bullet('Reply sent to user'),
  spacer(),
  h2('10.3  Database Entities'),
  simpleTable(
    ['Entity', 'Table', 'Key fields'],
    [
      ['UserEntity', 'users', 'telegramId (unique), username, preferences (jsonb)'],
      ['ConversationEntity', 'conversations', 'telegramId, messages (jsonb), summary (text)'],
      ['PermissionEntity', 'permissions', 'telegramId, scope (enum), granted (bool), grantedAt'],
      ['GoogleCredentialEntity', 'google_credentials', 'telegramId (unique), encryptedAccessToken, encryptedRefreshToken, expiresAt'],
      ['GroupSettingsEntity', 'group_settings', 'chatId (unique), botEnabled (bool), groupTitle, addedById'],
    ],
    [28, 25, 47],
  ),
  pageBreak(),

  // ── 11. Troubleshooting ──────────────────────────────────────────────────
  h1('11. Troubleshooting'),
  simpleTable(
    ['Symptom', 'Likely cause', 'Fix'],
    [
      ['Bot does not respond at all', 'Wrong TELEGRAM_BOT_TOKEN', 'Verify token from @BotFather'],
      ['Bot does not respond in group', 'Not @mentioned or bot is disabled', 'Use @botname or run /enable'],
      ['"Google account not connected" error', '/connect not completed', 'Run /connect and complete OAuth'],
      ['Google features return 403 errors', 'APIs not enabled in Google Cloud', 'Enable Docs/Sheets/Drive APIs in console.cloud.google.com'],
      ['TOKEN_ENCRYPTION_KEY error on startup', 'Key is missing or wrong length', 'Generate with: openssl rand -hex 32'],
      ['Health check returns 503', 'DB or Redis not reachable', 'Check docker-compose logs for postgres/redis'],
      ['Messages not remembered between restarts', 'Redis data not persisted', 'Check Redis volume in docker-compose.prod.yml'],
      ['Bot responds twice to same message', 'Multiple bot instances running', 'Ensure only one instance is active'],
      ['Rate limit triggered unexpectedly', 'RATE_LIMIT_PER_MINUTE set too low', 'Increase value in .env'],
    ],
    [28, 30, 42],
  ),
  pageBreak(),

  // ── 12. Quick Reference Card ─────────────────────────────────────────────
  h1('12. Quick Reference Card'),
  h2('All Commands at a Glance'),
  simpleTable(
    ['Command', 'Where', 'Description'],
    [
      ['/start', 'Private', 'Initialise your profile'],
      ['/help', 'Private', 'Show help and supported file types'],
      ['/permissions', 'Private', 'View / manage your consent grants'],
      ['/forget', 'Private', 'Clear current session memory'],
      ['/connect', 'Private', 'Link Google account via OAuth'],
      ['/disconnect', 'Private', 'Unlink Google account'],
      ['/gdoc <url> [instruction]', 'Private', 'Read / edit a Google Doc'],
      ['/gsheet <url> [range] [instruction]', 'Private', 'Read / update a Google Sheet'],
      ['/gdrive [query or ID]', 'Private', 'Browse or analyse Google Drive files'],
      ['/enable', 'Group (admin)', 'Enable bot in this group'],
      ['/disable', 'Group (admin)', 'Disable bot in this group'],
      ['/groupsettings', 'Group', 'Show group configuration'],
    ],
    [38, 20, 42],
  ),
  spacer(),
  h2('Supported Upload Formats'),
  pMixed(bold('📷 Images: '), normal('JPEG, PNG, GIF, WebP — visual analysis via Claude vision')),
  pMixed(bold('📄 PDF: '), normal('.pdf — text extraction up to 40,000 characters')),
  pMixed(bold('📊 Spreadsheets: '), normal('.csv, .xlsx, .xls, .ods — markdown table preview up to 200 rows')),
  pMixed(bold('💻 Code/Text: '), normal('.ts .js .py .go .java .json .yaml .md .html .sh and more')),
  spacer(),
  new Paragraph({
    children: [new TextRun({ text: '─────────────────────────────────────────────', color: 'CCCCCC', size: 18 })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'AI-Powered Telegram Assistant Bot  ·  Documentation v1.0  ·  April 2026', size: 18, color: '888888' })],
    alignment: AlignmentType.CENTER,
  }),
];

// ─── Build & save ──────────────────────────────────────────────────────────

const doc = new Document({
  creator: 'Telegram Assistant Bot',
  title: 'AI-Powered Telegram Assistant Bot — Complete Documentation',
  description: 'Full user guide and technical reference for the Telegram Assistant Bot',
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22 } },
      heading1: {
        run: { font: 'Calibri', bold: true, size: 32, color: BLUE },
        paragraph: { spacing: { before: 400, after: 200 } },
      },
      heading2: {
        run: { font: 'Calibri', bold: true, size: 26, color: '2C5282' },
        paragraph: { spacing: { before: 240, after: 120 } },
      },
      heading3: {
        run: { font: 'Calibri', bold: true, size: 23, color: '2D5016' },
        paragraph: { spacing: { before: 160, after: 80 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      children: [...coverPage, ...sections],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('Telegram-Assistant-Bot-Documentation.docx', buffer);
console.log('✅  Documentation saved: Telegram-Assistant-Bot-Documentation.docx');
