// Test script to verify the auth endpoint is working
const testAuthEndpoint = async () => {
  try {
    // Test the signup endpoint
    const response = await fetch('https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZHl2aG5hbGptZG13emZib3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTYwOTIsImV4cCI6MjA3OTE3MjA5Mn0.C4FzFi9NQH0fzJ-w1MAm2pLrefx4B98uNrXi5EuA_8U'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123',
        username: 'testuser'
      })
    });

    const data = await response.json();
    console.log('Signup response:', data);
    
    if (response.ok) {
      console.log('✅ Auth endpoint is working correctly!');
    } else {
      console.log('❌ Auth endpoint returned error:', data.error);
    }
  } catch (error) {
    console.error('❌ Error testing auth endpoint:', error);
  }
};

testAuthEndpoint();