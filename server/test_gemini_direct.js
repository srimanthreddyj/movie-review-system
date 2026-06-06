require('dotenv').config({ path: './.env' });

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Gemini API Key length:', apiKey ? apiKey.length : 0);
  if (!apiKey) {
    console.error('No Gemini API Key found in .env');
    return;
  }

  const prompt = `
    Provide a list of 20 highly popular and critically acclaimed movies.
    Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
    Format:
    [
      {
        "title": "Movie Title",
        "originalTitle": "",
        "releaseDate": "YYYY-MM-DD",
        "posterUrl": "",
        "refId": "gemini-popular-slug",
        "source": "gemini",
        "mediaType": "movie",
        "synopsis": "A brief synopsis",
        "genre": ["Action", "Drama"]
      }
    ]
  `;

  // We try gemini-flash-latest
  const model = 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    console.log(`Sending request to Gemini model ${model}...`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    console.log('Response status:', response.status);
    const timeTaken = (Date.now() - startTime) / 1000;
    console.log(`Time taken: ${timeTaken}s`);
    const data = await response.json();
    console.log('Response body keys/sample:', Object.keys(data));
    if (data.candidates && data.candidates[0]) {
      const text = data.candidates[0].content.parts[0].text;
      console.log('Text generated length:', text.length);
      console.log('First 500 chars of text:', text.substring(0, 500));
    } else {
      console.log('Error data:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testGemini();
