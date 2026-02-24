import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import app from './app.js';

const server = new Hono();

server.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: server.fetch, port }, (info) => {
    console.log(`khoborer-khoj-server listening on http://localhost:${info.port}`);
});
