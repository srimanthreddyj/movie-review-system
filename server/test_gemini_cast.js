require('dotenv').config();
const movieApiService = require('./services/movieApiService');

async function testGeminiCast() {
  console.log('Testing Cast Profile Fallback Enrichment (TMDB -> Gemini):');
  
  // Prabhas is in the database and was imported from OMDb, so his TMDB call should abort locally
  // and then fall back to Gemini AI to enrich bio, nationality, and birthDate.
  const name = 'Prabhas';
  console.log(`\nCalling enrichCastProfile for: "${name}"...`);
  
  const start = Date.now();
  const details = await movieApiService.enrichCastProfile(name);
  const duration = (Date.now() - start) / 1000;
  
  console.log(`\nRequest completed in ${duration}s.`);
  if (details) {
    console.log(`✅ Success (Data Source: ${details.dataSource}):`);
    console.log(`  gender: "${details.gender}"`);
    console.log(`  birthDate: "${details.birthDate}"`);
    console.log(`  nationality: "${details.nationality}"`);
    console.log(`  bio excerpt: "${details.bio.slice(0, 150)}..."`);
  } else {
    console.log(`❌ Failed to enrich "${name}" via TMDB or Gemini`);
  }
}

testGeminiCast();
