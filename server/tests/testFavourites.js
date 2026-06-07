require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Cast = require('./models/Cast');
const Clip = require('./models/Clip');
const connectDB = require('./config/db');

async function runTests() {
  console.log('Connecting to database...');
  await connectDB();

  // Clean up any old test data
  const testEmail = 'test_fav_user_' + Date.now() + '@example.com';
  let testUser = null;
  let testMovie = null;
  let testCast = null;
  let testClip = null;

  try {
    // 1. Create a Test User
    console.log('Creating test user...');
    testUser = new User({
      name: 'Test Fav User',
      email: testEmail,
      passwordHash: 'dummy_hash',
      role: 'user'
    });
    await testUser.save();
    console.log(`Test user created with ID: ${testUser._id}`);

    // 2. Create a Test Movie
    console.log('Creating test movie...');
    testMovie = new Movie({
      title: 'Inception (Test)',
      mediaType: 'movie',
      language: 'English',
      status: 'released'
    });
    await testMovie.save();
    console.log(`Test movie created with ID: ${testMovie._id}`);

    // 3. Create a Test Cast Member
    console.log('Creating test cast member...');
    testCast = new Cast({
      name: 'Leonardo DiCaprio (Test)',
      gender: 'Male',
      knownFor: 'Actor'
    });
    await testCast.save();
    console.log(`Test cast member created with ID: ${testCast._id}`);

    // 4. Create a Test Clip
    console.log('Creating test clip...');
    testClip = new Clip({
      movieId: testMovie._id,
      title: 'Inception Trailer (Test)',
      url: 'https://youtube.com/inception',
      addedBy: testUser._id
    });
    await testClip.save();
    console.log(`Test clip created with ID: ${testClip._id}`);

    // 5. Test Toggle Favourites (Simulation of controller logic)
    const favouritesController = require('./controllers/favouritesController');

    // Helper mock objects to simulate express req, res
    const createMockReqRes = (params = {}, body = {}) => {
      const req = {
        user: { id: testUser._id.toString() },
        params,
        body
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
      return { req, res };
    };

    console.log('\n--- Test 1: Add Movie to Favourites ---');
    let { req, res } = createMockReqRes({ entityType: 'movies', id: testMovie._id.toString() });
    await favouritesController.toggleFavourite(req, res);
    console.log('Res status:', res.statusCode || 200, 'data:', res.data);
    if (!res.data.isFavourite) throw new Error('Movie should be favourited');

    console.log('\n--- Test 2: Add Cast to Favourites ---');
    ({ req, res } = createMockReqRes({ entityType: 'cast', id: testCast._id.toString() }));
    await favouritesController.toggleFavourite(req, res);
    console.log('Res status:', res.statusCode || 200, 'data:', res.data);
    if (!res.data.isFavourite) throw new Error('Cast should be favourited');

    console.log('\n--- Test 3: Add Clip to Favourites ---');
    ({ req, res } = createMockReqRes({ entityType: 'clips', id: testClip._id.toString() }));
    await favouritesController.toggleFavourite(req, res);
    console.log('Res status:', res.statusCode || 200, 'data:', res.data);
    if (!res.data.isFavourite) throw new Error('Clip should be favourited');

    console.log('\n--- Test 4: Update Priority Level to High ---');
    ({ req, res } = createMockReqRes({ entityType: 'movies', id: testMovie._id.toString() }, { level: 'High' }));
    await favouritesController.updateLevel(req, res);
    console.log('Res status:', res.statusCode || 200, 'data:', res.data);
    if (res.data.level !== 'High') throw new Error('Level should be High');

    console.log('\n--- Test 5: Update priority level to invalid value (should fail) ---');
    ({ req, res } = createMockReqRes({ entityType: 'movies', id: testMovie._id.toString() }, { level: 'SuperHigh' }));
    await favouritesController.updateLevel(req, res);
    console.log('Res status:', res.statusCode, 'data:', res.data);
    if (res.statusCode !== 400) throw new Error('Should have failed with 400');

    console.log('\n--- Test 6: Get Populated Favourites ---');
    ({ req, res } = createMockReqRes());
    await favouritesController.getFavourites(req, res);
    console.log('Res status:', res.statusCode || 200);
    console.log('Populated Favourites output:');
    console.log('- Movies count:', res.data.movies.length);
    console.log('  Movie title:', res.data.movies[0]?.details?.title);
    console.log('  Movie level:', res.data.movies[0]?.level);
    console.log('- Cast count:', res.data.cast.length);
    console.log('  Cast name:', res.data.cast[0]?.details?.name);
    console.log('  Cast level:', res.data.cast[0]?.level);
    console.log('- Clips count:', res.data.clips.length);
    console.log('  Clip title:', res.data.clips[0]?.details?.title);
    console.log('  Clip level:', res.data.clips[0]?.level);

    if (res.data.movies.length !== 1 || res.data.movies[0].level !== 'High') {
      throw new Error('Populated movies verification failed');
    }
    if (res.data.cast.length !== 1 || res.data.cast[0].level !== 'Medium') {
      throw new Error('Populated cast verification failed');
    }
    if (res.data.clips.length !== 1 || res.data.clips[0].level !== 'Medium') {
      throw new Error('Populated clips verification failed');
    }

    console.log('\n--- Test 7: Toggle off Movie from Favourites ---');
    ({ req, res } = createMockReqRes({ entityType: 'movies', id: testMovie._id.toString() }));
    await favouritesController.toggleFavourite(req, res);
    console.log('Res status:', res.statusCode || 200, 'data:', res.data);
    if (res.data.isFavourite) throw new Error('Movie should be removed from favourites');

    console.log('\n--- Verification completed successfully! All checks passed. ---');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up test database documents...');
    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (testMovie) await Movie.deleteOne({ _id: testMovie._id });
    if (testCast) await Cast.deleteOne({ _id: testCast._id });
    if (testClip) await Clip.deleteOne({ _id: testClip._id });

    console.log('Disconnecting from database...');
    await mongoose.connection.close();
    console.log('Finished.');
  }
}

runTests();
