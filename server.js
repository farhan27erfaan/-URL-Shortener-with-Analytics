import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'url-shortener-super-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database initialization
let db;
async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Create tables if they do not exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      short_code TEXT UNIQUE NOT NULL,
      long_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      click_count INTEGER DEFAULT 0,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      visited_at TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      browser TEXT,
      device TEXT,
      link_id TEXT NOT NULL,
      FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
    );
  `);
  
  console.log('SQLite database initialized successfully.');
}

// Helper to generate unique random short code
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simple parser for Browser and Device from User Agent
function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', device: 'Desktop' };
  
  let browser = 'Other';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome') && !ua.includes('Chromium') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'IE';

  let device = 'Desktop';
  if (ua.includes('Mobi') || ua.includes('Android') || ua.includes('iPhone')) {
    device = 'Mobile';
  } else if (ua.includes('iPad') || ua.includes('Tablet')) {
    device = 'Tablet';
  }

  return { browser, device };
}

// Helper to generate random IDs (alternative to uuid)
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// --- API ROUTES ---

// 1. Signup
app.post('/api/v1/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = generateId();
    const createdAt = new Date().toISOString();

    await db.run(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, createdAt]
    );

    res.status(201).json({ message: 'User created successfully', userId });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Email address already registered' });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// 2. Login
app.post('/api/v1/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// 3. Create Short Link
app.post('/api/v1/links', authenticateToken, async (req, res) => {
  const { longUrl, customCode } = req.body;
  if (!longUrl) {
    return res.status(400).json({ error: 'Long URL is required' });
  }

  // URL Validation
  try {
    new URL(longUrl);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid long URL format (include http:// or https://)' });
  }

  try {
    let shortCode = customCode ? customCode.trim() : '';
    
    if (shortCode) {
      // Validate custom code format (alphanumeric, dashes, underscores)
      if (!/^[a-zA-Z0-9-_]+$/.test(shortCode)) {
        return res.status(400).json({ error: 'Custom alias must only contain letters, numbers, dashes (-), and underscores (_)' });
      }
      
      // Check if custom code is taken
      const existing = await db.get('SELECT id FROM links WHERE short_code = ?', [shortCode]);
      if (existing) {
        return res.status(409).json({ error: 'Custom alias is already taken' });
      }
    } else {
      // Generate a unique code
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        shortCode = generateShortCode();
        const existing = await db.get('SELECT id FROM links WHERE short_code = ?', [shortCode]);
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      if (!isUnique) {
        return res.status(500).json({ error: 'Could not generate a unique short code. Please try again.' });
      }
    }

    const id = generateId();
    const createdAt = new Date().toISOString();

    await db.run(
      'INSERT INTO links (id, short_code, long_url, created_at, owner_id) VALUES (?, ?, ?, ?, ?)',
      [id, shortCode, longUrl, createdAt, req.user.id]
    );

    const fullShortUrl = `${req.protocol}://${req.get('host')}/r/${shortCode}`;

    res.status(201).json({
      id,
      shortCode,
      shortUrl: fullShortUrl,
      longUrl,
      clickCount: 0,
      createdAt
    });
  } catch (err) {
    console.error('Create link error:', err);
    res.status(500).json({ error: 'Internal server error creating link' });
  }
});

// 4. Get User Links
app.get('/api/v1/links', authenticateToken, async (req, res) => {
  try {
    const links = await db.all(
      'SELECT * FROM links WHERE owner_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    
    // Map with absolute shortUrl
    const formattedLinks = links.map(link => ({
      ...link,
      shortUrl: `${req.protocol}://${req.get('host')}/r/${link.short_code}`
    }));

    res.json(formattedLinks);
  } catch (err) {
    console.error('Fetch links error:', err);
    res.status(500).json({ error: 'Internal server error fetching links' });
  }
});

// 5. Update Link Code (Change Alias)
app.patch('/api/v1/links/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { shortCode } = req.body;

  if (!shortCode || !shortCode.trim()) {
    return res.status(400).json({ error: 'New short code is required' });
  }

  const cleanCode = shortCode.trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(cleanCode)) {
    return res.status(400).json({ error: 'Alias must only contain letters, numbers, dashes (-), and underscores (_)' });
  }

  try {
    // Check ownership
    const link = await db.get('SELECT * FROM links WHERE id = ?', [id]);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    if (link.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this link' });
    }

    // Check availability
    if (cleanCode !== link.short_code) {
      const existing = await db.get('SELECT id FROM links WHERE short_code = ?', [cleanCode]);
      if (existing) {
        return res.status(409).json({ error: 'This alias is already taken' });
      }
    }

    await db.run(
      'UPDATE links SET short_code = ? WHERE id = ?',
      [cleanCode, id]
    );

    res.json({
      message: 'Link updated successfully',
      id,
      shortCode: cleanCode,
      shortUrl: `${req.protocol}://${req.get('host')}/r/${cleanCode}`
    });
  } catch (err) {
    console.error('Update link error:', err);
    res.status(500).json({ error: 'Internal server error updating link' });
  }
});

// 6. Delete Link
app.delete('/api/v1/links/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check ownership
    const link = await db.get('SELECT * FROM links WHERE id = ?', [id]);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    if (link.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this link' });
    }

    await db.run('DELETE FROM links WHERE id = ?', [id]);
    res.json({ message: 'Link deleted successfully' });
  } catch (err) {
    console.error('Delete link error:', err);
    res.status(500).json({ error: 'Internal server error deleting link' });
  }
});

// 7. Get Link Analytics
app.get('/api/v1/links/:id/analytics', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check ownership
    const link = await db.get('SELECT * FROM links WHERE id = ?', [id]);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    if (link.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view analytics' });
    }

    // Get recent visits
    const visits = await db.all(
      'SELECT visited_at, referrer, browser, device FROM visits WHERE link_id = ? ORDER BY visited_at DESC LIMIT 100',
      [id]
    );

    // Group analytics by date (last 7 days), browser, and device
    const totalClicks = link.click_count;

    const browsers = await db.all(
      'SELECT browser, COUNT(*) as count FROM visits WHERE link_id = ? GROUP BY browser ORDER BY count DESC',
      [id]
    );

    const devices = await db.all(
      'SELECT device, COUNT(*) as count FROM visits WHERE link_id = ? GROUP BY device ORDER BY count DESC',
      [id]
    );

    const referrers = await db.all(
      'SELECT referrer, COUNT(*) as count FROM visits WHERE link_id = ? GROUP BY referrer ORDER BY count DESC LIMIT 10',
      [id]
    );

    // Click timeline (clicks per day for last 7 days)
    const timeline = await db.all(`
      SELECT date(visited_at) as date, COUNT(*) as count 
      FROM visits 
      WHERE link_id = ? AND visited_at >= date('now', '-7 days')
      GROUP BY date(visited_at)
      ORDER BY date ASC
    `, [id]);

    res.json({
      link: {
        id: link.id,
        shortCode: link.short_code,
        shortUrl: `${req.protocol}://${req.get('host')}/r/${link.short_code}`,
        longUrl: link.long_url,
        createdAt: link.created_at,
        clickCount: totalClicks
      },
      analytics: {
        totalClicks,
        browsers,
        devices,
        referrers,
        timeline,
        recentVisits: visits
      }
    });
  } catch (err) {
    console.error('Fetch analytics error:', err);
    res.status(500).json({ error: 'Internal server error fetching analytics' });
  }
});

// --- PUBLIC REDIRECT ROUTE ---
app.get('/r/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  try {
    const link = await db.get('SELECT * FROM links WHERE short_code = ?', [shortCode]);
    if (!link) {
      return res.status(404).send('<h1>Link Not Found</h1><p>The shortened link you are trying to visit does not exist.</p>');
    }

    // Record visit details asynchronously
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const uaString = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || 'Direct';
    const { browser, device } = parseUserAgent(uaString);

    const visitId = generateId();
    const visitedAt = new Date().toISOString();

    // Increment click count and store click details
    await db.run('UPDATE links SET click_count = click_count + 1 WHERE id = ?', [link.id]);
    await db.run(
      'INSERT INTO visits (id, visited_at, referrer, user_agent, ip_address, browser, device, link_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [visitId, visitedAt, referrer, uaString, ip, browser, device, link.id]
    );

    // Perform HTTP 301 Permanent Redirect
    res.redirect(301, link.long_url);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).send('<h1>Server Error</h1><p>An error occurred while trying to redirect you.</p>');
  }
});

// Serve frontend SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
