import fetch from 'node-fetch';

// Test the wine update endpoint directly
const testWineUpdate = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/wines/33', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AyourSessionId' // You'll need to get this from browser
      },
      body: JSON.stringify({
        rating: 5,
        notes: 'Test direct update'
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());
    const result = await response.text();
    console.log('Response body:', result);
  } catch (error) {
    console.error('Error:', error);
  }
};

testWineUpdate();