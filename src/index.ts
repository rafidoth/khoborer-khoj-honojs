import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import app from './app.js';

const server = new Hono();

server.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.get('/scrape', async (c) => {
    console.log('Manual scrape triggered');
    const startTime = Date.now();

    try {
        const results = await app();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalArticles = results.reduce((sum, r) => sum + r.articles.length, 0);

        return c.json({
            success: true,
            duration: `${duration}s`,
            sources: results.length,
            totalArticles,
            results,
        });
    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error('Scrape failed:', err);

        return c.json(
            {
                success: false,
                duration: `${duration}s`,
                error: err instanceof Error ? err.message : 'Unknown error',
            },
            500,
        );
    }
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: server.fetch, port }, (info) => {
    console.log(`khoborer-khoj-server listening on http://localhost:${info.port}`);
});
