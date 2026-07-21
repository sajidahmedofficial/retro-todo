export const config = {
  // Replace this with your deployed AI Backend URL when available
  // e.g., 'https://my-retro-ai-backend.com'
  AI_BACKEND_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : null
};
