import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// --- Feishu API Helpers ---

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getTenantAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Feishu Auth Error: ${data.msg}`);
  }

  cachedToken = data.tenant_access_token;
  tokenExpiry = Date.now() + (data.expire - 60) * 1000; // Buffer of 60s
  return cachedToken;
}

// --- API Routes ---

// Get Q&A Base
app.get('/api/feishu/qa', async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_APP_TOKEN}/tables/${process.env.FEISHU_TABLE_ID_QA}/records`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.code !== 0) throw new Error(data.msg);

    const records = data.data.items.map((item: any) => ({
      recordId: item.record_id,
      id: item.fields.id,
      category: item.fields.category,
      question: item.fields.question,
      script: item.fields.script,
      notes: item.fields.notes || '',
      updated_at: item.fields.updated_at || Date.now(),
    }));

    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Feedback Pool
app.get('/api/feishu/feedback', async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_APP_TOKEN}/tables/${process.env.FEISHU_TABLE_ID_FEEDBACK}/records?sort=%5B%22created_at%20DESC%22%5D`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.code !== 0) throw new Error(data.msg);

    const records = data.data.items.map((item: any) => ({
      recordId: item.record_id,
      id: item.fields.id,
      user_voice: item.fields.user_voice,
      channel: item.fields.channel,
      status: item.fields.status,
      submitter: item.fields.submitter,
      created_at: item.fields.created_at || Date.now(),
    }));

    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Feedback
app.post('/api/feishu/feedback', async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_APP_TOKEN}/tables/${process.env.FEISHU_TABLE_ID_FEEDBACK}/records`;
    
    const { user_voice, channel, submitter } = req.body;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          user_voice,
          channel,
          submitter,
          status: 'pending',
          created_at: Date.now()
        }
      })
    });
    const data = await response.json();

    if (data.code !== 0) throw new Error(data.msg);
    res.json(data.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Feedback Status
app.patch('/api/feishu/feedback/:recordId', async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const { recordId } = req.params;
    const { status } = req.body;
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_APP_TOKEN}/tables/${process.env.FEISHU_TABLE_ID_FEEDBACK}/records/${recordId}`;
    
    const response = await fetch(url, {
      method: 'PUT', // Bitable uses PUT for partial updates if you only send some fields
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: { status }
      })
    });
    const data = await response.json();

    if (data.code !== 0) throw new Error(data.msg);
    res.json(data.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Convert Feedback to QA
app.post('/api/feishu/convert', async (req, res) => {
  try {
    const token = await getTenantAccessToken();
    const { feedbackRecordId, qaData } = req.body;

    // 1. Create QA Record
    const qaUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_APP_TOKEN}/tables/${process.env.FEISHU_TABLE_ID_QA}/records`;
    const qaRes = await fetch(qaUrl, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          ...qaData,
          updated_at: Date.now()
        }
      })
    });
    const qaResult = await qaRes.json();
    if (qaResult.code !== 0) throw new Error(`QA Create Error: ${qaResult.msg}`);

    // 2. Update Feedback Status to Resolved
    const feedbackUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_APP_TOKEN}/tables/${process.env.FEISHU_TABLE_ID_FEEDBACK}/records/${feedbackRecordId}`;
    const fbRes = await fetch(feedbackUrl, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: { status: 'resolved' }
      })
    });
    const fbResult = await fbRes.json();
    if (fbResult.code !== 0) throw new Error(`Feedback Update Error: ${fbResult.msg}`);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
