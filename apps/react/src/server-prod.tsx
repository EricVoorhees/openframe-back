#!/usr/bin/env bun
import { serve, file } from 'bun';
import { join } from 'path';

const PORT = process.env.PORT || 4000;
const DIST_DIR = join(import.meta.dir, '..', 'dist');

console.log(`📁 Serving from: ${DIST_DIR}`);
console.log(`🚀 Server starting on port ${PORT}...`);

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = join(DIST_DIR, url.pathname);
    
    // Try to serve the requested file
    let response = file(filePath);
    
    // If file exists, serve it
    if (await response.exists()) {
      return new Response(response);
    }
    
    // If not found, try adding .html extension
    if (!url.pathname.includes('.')) {
      response = file(`${filePath}.html`);
      if (await response.exists()) {
        return new Response(response);
      }
    }
    
    // Fall back to index.html for SPA routing
    response = file(join(DIST_DIR, 'index.html'));
    if (await response.exists()) {
      return new Response(response, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // 404 if nothing found
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Server running at http://localhost:${PORT}/`);

