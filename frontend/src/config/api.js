// API Configuration for both development and production
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_API_URL || 'https://your-backend-url.vercel.app' // Replace with your actual backend URL
  : 'http://localhost:5000'; // Use localhost in development

export default API_BASE_URL;