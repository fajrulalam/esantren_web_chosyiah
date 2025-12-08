import * as cors from 'cors';
import * as functions from 'firebase-functions';

// Initialize CORS middleware with ALL origins allowed
export const corsHandler = cors({
  origin: true, // Allow requests from any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
});

// Function to manually set CORS headers for any endpoint
export const setCorsHeaders = (response: functions.Response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  response.set('Access-Control-Max-Age', '86400');
};

// Standalone middleware to handle CORS for any endpoint
export const manualCorsMiddleware = (request: functions.Request, response: functions.Response, next: () => Promise<void>) => {
  // Set the CORS headers on the response
  setCorsHeaders(response);
  
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    // Send 204 No Content
    response.status(204).send('');
    return;
  }
  
  // Continue with the next handler
  return next();
};