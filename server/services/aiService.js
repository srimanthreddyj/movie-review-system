// AI Service for CineTrack leveraging Google Gemini API

/**
 * Generate movie explanation/review using Gemini API
 * @param {Object} movie - Movie document from MongoDB
 * @param {Array} castMembers - List of populated cast members
 * @returns {Promise<string>} - The generated explanation text in Markdown
 */
exports.generateMovieExplanation = async (movie, castMembers) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured in environment variables');
  }

  // Construct cast names and characters/roles for context
  const castListText = (castMembers || [])
    .map(c => `- ${c.name} as ${c.characterName || 'themselves'} (${c.role || 'Actor'})`)
    .join('\n');

  // Build a highly tailored prompt
  const prompt = `
You are CineTrack AI, a professional film critic and movie analyst. Provide an engaging, detailed, and structured review and explanation of the following ${movie.mediaType === 'series' ? 'TV Series/Show' : 'Movie'}:

Title: ${movie.title}
Original Title: ${movie.originalTitle || 'N/A'}
Type: ${movie.mediaType === 'series' ? 'TV Series/Show' : 'Feature Film'}
Language: ${movie.language}
Genres: ${movie.genre && movie.genre.length > 0 ? movie.genre.join(', ') : 'N/A'}
Synopsis/Overview: ${movie.synopsis || 'N/A'}

Cast & Crew:
${castListText || 'N/A'}

Your explanation MUST be formatted in Markdown and include the following sections:
1. **Plot Overview & Core Themes**: A compelling summary of the plot and an analysis of the central themes (e.g. survival, fate, identity).
2. **Key Characters & Performances**: Detail the major characters and the impact of the actors' performances.
3. **Cinematic Highlights & Production**: Mention key elements of direction, writing, soundtrack, or visual effects.
4. **Why It Is Worth Watching**: A summary of what makes this production unique, and your final takeaway rating out of 10.

Keep the tone intellectual, entertaining, and completely free of placeholders. Provide only the Markdown output.
`;

  // Define API URLs (Try gemini-2.5-flash first, fall back to gemini-1.5-flash if needed)
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      console.log(`Sending request to Gemini API model: ${model}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      
      // Extract generated text
      if (
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0]
      ) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Unexpected API response structure (candidates or parts missing)');
      }
    } catch (error) {
      console.warn(`Gemini Model ${model} failed:`, error.message);
      lastError = error;
    }
  }

  throw new Error(`All Gemini API models failed. Last error: ${lastError.message}`);
};

/**
 * Generate a local, structured markdown summary from movie metadata as a fallback when Gemini is offline
 * @param {Object} movie - Movie document from MongoDB
 * @param {Array} castMembers - List of populated cast members
 * @returns {string} - Locally compiled Markdown profile
 */
exports.generateLocalFallbackExplanation = (movie, castMembers) => {
  const genres = movie.genre && movie.genre.length > 0 ? movie.genre.join(', ') : 'N/A';
  
  // Format cast list
  const castListText = (castMembers || [])
    .map(c => `- **${c.name}** as *${c.characterName || 'themselves'}* (${c.role || 'Actor'})`)
    .slice(0, 10)
    .join('\n');

  return `
# ${movie.title} (Local Profile)

> [!NOTE]
> This overview was compiled locally using database metadata as the live AI critic is currently unavailable.

## 1. Plot Overview & Core Themes
${movie.synopsis || 'No synopsis is currently available for this title.'}

**Metadata:**
- **Original Title:** ${movie.originalTitle || movie.title}
- **Media Type:** ${movie.mediaType === 'series' ? 'TV Series/Show' : 'Feature Film'}
- **Original Language:** ${movie.language || 'English'}
- **Genres:** ${genres}

## 2. Key Characters & Performances
Below is the principal cast list for this production:
${castListText || '- *No cast information has been added yet.*'}

## 3. Cinematic Highlights & Production
This ${movie.mediaType === 'series' ? 'TV Series/Show' : 'Feature Film'} has been catalogued under **${genres}**. Highlights and themes typically explore the core elements of these genres. 

## 4. Why It Is Worth Watching
If you are a fan of ${genres} story arcs, this entry is highly worth adding to your tracking lists.
**Track Rating:** 7/10
  `.trim();
};

