// Simple test to check what the dashboard API is returning
// Run this in your browser console or as a separate test

const API_BASE_URL = 'http://localhost:5000'; // Adjust if different

async function testDashboardAPI() {
  try {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('Testing dashboard API...');
    
    const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`, { headers });
    const data = await response.json();
    
    console.log('Dashboard API Response:', data);
    console.log('Customer count from API:', data.metrics?.customers);
    console.log('Supplier count from API:', data.metrics?.suppliers);
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
  }
}

// Run the test
testDashboardAPI();