import * as cors from 'cors';

// Initialize CORS middleware with allowed origins
export const corsHandler = cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://e-santren.web.app',
    'https://e-santren.firebaseapp.com',
    'https://esantren-chosyiah.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});