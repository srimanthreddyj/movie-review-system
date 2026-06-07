require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const castController = require('./controllers/castController');
const Cast = require('./models/Cast');

async function testExternalPerson() {
  console.log('Connecting to database...');
  await connectDB();

  try {
    // 1. Search for a person, e.g., "Keanu Reeves"
    const searchQuery = 'Keanu Reeves';
    console.log(`\n--- Test 1: Searching for cast member "${searchQuery}" ---`);

    const reqSearch = { query: { q: searchQuery } };
    const resSearch = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };

    await castController.searchExternalCast(reqSearch, resSearch);
    console.log('Search Status:', resSearch.statusCode || 200);
    console.log('Results Count:', resSearch.data ? resSearch.data.length : 0);

    if (resSearch.data && resSearch.data.length > 0) {
      console.log('First search result sample:', resSearch.data[0]);
      
      // Let's delete the person from DB first to test import cleanly
      const targetName = resSearch.data[0].name;
      const targetTmdbId = resSearch.data[0].tmdbId;
      console.log(`Deleting existing local profiles matching Name: ${targetName} or TMDB ID: ${targetTmdbId}...`);
      await Cast.deleteMany({ $or: [{ tmdbId: targetTmdbId }, { name: targetName }] });

      // 2. Import the person
      console.log(`\n--- Test 2: Importing cast member "${targetName}" (TMDB ID: ${targetTmdbId}) ---`);
      const reqImport = { body: { tmdbId: targetTmdbId } };
      const resImport = {
        status(code) { this.statusCode = code; return this; },
        json(data) { this.data = data; return this; }
      };

      await castController.importExternalCast(reqImport, resImport);
      console.log('Import Status:', resImport.statusCode || 201);
      console.log('Imported cast details:', resImport.data);

      // Verify it exists in database
      const foundInDb = await Cast.findOne({ tmdbId: targetTmdbId });
      if (foundInDb) {
        console.log('SUCCESS: Person found in local database with ID:', foundInDb._id);
      } else {
        console.log('FAILURE: Person was not saved in the database.');
      }
    } else {
      console.log('No search results returned for Cast.');
    }

  } catch (error) {
    console.error('Cast import test failed:', error);
  } finally {
    console.log('\nClosing DB connection...');
    await mongoose.connection.close();
    console.log('Done.');
  }
}

testExternalPerson();
