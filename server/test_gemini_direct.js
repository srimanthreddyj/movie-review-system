require('dotenv').config({ path: './.env' });

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Gemini API Key length:', apiKey ? apiKey.length : 0);
  if (!apiKey) {
    console.error('No Gemini API Key found in .env');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: "Hello! Reply with 'OK' if you can read this." }] }]
  };

  try {
    console.log('Sending request to Gemini...');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response body:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testGemini();
