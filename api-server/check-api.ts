
async function checkApi() {
  try {
    const response = await fetch('http://localhost:3000/api/events');
    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      return;
    }
    const data = await response.json();
    console.log(`API returned ${Array.isArray(data) ? data.length : 'invalid'} events`);
    if (Array.isArray(data) && data.length > 0) {
      console.log('Sample event from API:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('API response:', data);
    }
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

checkApi();
