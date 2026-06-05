require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Cast = require('./models/Cast');
const connectDB = require('./config/db');

async function runTests() {
  console.log('Connecting to database...');
  await connectDB();

  const testEmail = 'test_ai_user_' + Date.now() + '@example.com';
  let testUser = null;
  let testMovie = null;
  let testCast = null;

  try {
    // 1. Create a Test User
    console.log('Creating test user...');
    testUser = new User({
      name: 'Test AI User',
      email: testEmail,
      passwordHash: 'dummy_hash',
      role: 'user'
    });
    await testUser.save();
    console.log(`Test user created with ID: ${testUser._id}`);

    // 2. Create a Test Cast Member
    console.log('Creating test cast member...');
    testCast = new Cast({
      name: 'Zendaya (Test)',
      gender: 'Female',
      knownFor: 'Actress'
    });
    await testCast.save();
    console.log(`Test cast member created with ID: ${testCast._id}`);

    // 3. Create a Test Movie
    console.log('Creating test movie...');
    testMovie = new Movie({
      title: 'Challengers (Test)',
      mediaType: 'movie',
      language: 'English',
      status: 'released',
      synopsis: 'Three players who knew each other when they were teenagers compete in a tennis tournament to be the world-famous grand slam winner.',
      genre: ['Drama', 'Romance', 'Sport'],
      cast: [{
        castId: testCast._id,
        characterName: 'Tashi Donaldson',
        role: 'Actress'
      }]
    });
    await testMovie.save();
    console.log(`Test movie created with ID: ${testMovie._id}`);

    // 4. Test Controller Method
    const movieController = require('./controllers/movieController');

    const req = {
      user: { id: testUser._id.toString(), role: testUser.role },
      params: { id: testMovie._id.toString() }
    };

    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    console.log('\n--- Executing generateExplanation controller action ---');
    console.log('This will make a live network request to the Google Gemini API...');
    
    await movieController.generateExplanation(req, res);
    
    console.log('\nResponse status:', res.statusCode || 200);
    if (res.statusCode && res.statusCode !== 200) {
      throw new Error(`Controller returned error: ${res.data?.message || JSON.stringify(res.data)}`);
    }

    console.log('Output keys returned:', Object.keys(res.data));
    console.log('Explanation Generated At:', res.data.explanationGeneratedAt);
    console.log('\nGenerated Gemini Markdown Explanation Preview:');
    console.log('----------------------------------------------------');
    
    // Print first 500 characters of the response
    const preview = res.data.explanation.slice(0, 700);
    console.log(preview + '\n... [truncated for logs]');
    console.log('----------------------------------------------------');

    // 5. Verify database commit
    console.log('\nVerifying database commit...');
    const updatedMovie = await Movie.findById(testMovie._id);
    if (!updatedMovie.explanation) {
      throw new Error('Explanation was not saved to movie document in DB');
    }
    if (!updatedMovie.explanationGeneratedAt) {
      throw new Error('explanationGeneratedAt timestamp was not saved to DB');
    }
    console.log('Verification passed: Database committed correctly!');
    console.log('\n--- Verification completed successfully! All checks passed. ---');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up database documents...');
    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (testCast) await Cast.deleteOne({ _id: testCast._id });
    if (testMovie) await Movie.deleteOne({ _id: testMovie._id });

    console.log('Disconnecting from database...');
    await mongoose.connection.close();
    console.log('Finished.');
  }
}

runTests();
