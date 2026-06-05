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

  const timeSuffix = Date.now();
  const testEmailA = `test_clips_a_${timeSuffix}@example.com`;
  const testEmailB = `test_clips_b_${timeSuffix}@example.com`;

  let userA = null;
  let userB = null;
  let testMovie = null;
  let testCast = null;
  let testClip = null;

  try {
    // 1. Create Test Users
    console.log('Creating test users...');
    userA = new User({ name: 'User A', email: testEmailA, passwordHash: 'hash', role: 'user' });
    userB = new User({ name: 'User B', email: testEmailB, passwordHash: 'hash', role: 'user' });
    await Promise.all([userA.save(), userB.save()]);
    console.log(`User A ID: ${userA._id}, User B ID: ${userB._id}`);

    // 2. Create Test Movie
    console.log('Creating test movie...');
    testMovie = new Movie({ title: 'Interstellar (Test)', mediaType: 'movie' });
    await testMovie.save();
    console.log(`Movie ID: ${testMovie._id}`);

    // 3. Create Test Cast
    console.log('Creating test cast...');
    testCast = new Cast({ name: 'Anne Hathaway (Test)', gender: 'Female', knownFor: 'Actor' });
    await testCast.save();
    console.log(`Cast ID: ${testCast._id}`);

    // 4. Test Add Clip (Simulation)
    console.log('\n--- Test 1: Add Clip ---');
    const clipsController = require('./controllers/clipsController');

    const createMockReqRes = (user, params = {}, body = {}, query = {}) => {
      const req = {
        user: user ? { id: user._id.toString(), role: user.role } : null,
        params,
        body,
        query
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

    let { req, res } = createMockReqRes(
      userA,
      {},
      {
        movieId: testMovie._id.toString(),
        title: 'Interstellar Docking Scene (Test)',
        url: 'https://youtube.com/docking',
        description: 'No time for caution',
        clipType: 'scene',
        castInvolved: [testCast._id.toString()]
      }
    );

    await clipsController.addClip(req, res);
    console.log('Add Clip status:', res.statusCode || 201);
    if (!res.data || !res.data._id) {
      throw new Error('Failed to create clip');
    }
    testClip = res.data;
    console.log(`Clip created: ${testClip.title} (${testClip._id})`);

    // 5. Test Get Clips (Filtering)
    console.log('\n--- Test 2: Get Clips with Filters ---');

    // Filter by movieId
    ({ req, res } = createMockReqRes(null, {}, {}, { movieId: testMovie._id.toString() }));
    await clipsController.getClips(req, res);
    console.log('Filter by movieId count:', res.data.length);
    if (res.data.length !== 1) throw new Error('Filter by movieId failed');

    // Filter by castId
    ({ req, res } = createMockReqRes(null, {}, {}, { castId: testCast._id.toString() }));
    await clipsController.getClips(req, res);
    console.log('Filter by castId count:', res.data.length);
    if (res.data.length !== 1) throw new Error('Filter by castId failed');

    // Filter by invalid castId
    ({ req, res } = createMockReqRes(null, {}, {}, { castId: new mongoose.Types.ObjectId().toString() }));
    await clipsController.getClips(req, res);
    console.log('Filter by invalid castId count:', res.data.length);
    if (res.data.length !== 0) throw new Error('Filter by invalid castId should return 0 results');

    // 6. Test Edit Clip (Access Control)
    console.log('\n--- Test 3: Edit Clip (Owner) ---');
    ({ req, res } = createMockReqRes(
      userA,
      { id: testClip._id.toString() },
      { title: 'Interstellar Docking Scene - Updated (Test)' }
    ));
    await clipsController.updateClip(req, res);
    console.log('Update by owner status:', res.statusCode || 200);
    if (res.data.title !== 'Interstellar Docking Scene - Updated (Test)') {
      throw new Error('Update by owner failed');
    }

    console.log('\n--- Test 4: Edit Clip (Non-owner, should fail) ---');
    ({ req, res } = createMockReqRes(
      userB,
      { id: testClip._id.toString() },
      { title: 'Hacked Title (Test)' }
    ));
    await clipsController.updateClip(req, res);
    console.log('Update by non-owner status:', res.statusCode);
    if (res.statusCode !== 403) {
      throw new Error('Update by non-owner should have returned 403 Forbidden');
    }

    // 7. Test Delete Clip
    console.log('\n--- Test 5: Delete Clip (Non-owner, should fail) ---');
    ({ req, res } = createMockReqRes(userB, { id: testClip._id.toString() }));
    await clipsController.deleteClip(req, res);
    console.log('Delete by non-owner status:', res.statusCode);
    if (res.statusCode !== 403) {
      throw new Error('Delete by non-owner should have returned 403 Forbidden');
    }

    console.log('\n--- Test 6: Delete Clip (Owner) ---');
    ({ req, res } = createMockReqRes(userA, { id: testClip._id.toString() }));
    await clipsController.deleteClip(req, res);
    console.log('Delete by owner status:', res.statusCode || 200, 'data:', res.data);
    if (res.statusCode === 403) {
      throw new Error('Delete by owner failed');
    }

    // Verify deleted
    const clipCheck = await Clip.findById(testClip._id);
    if (clipCheck) throw new Error('Clip was not deleted from database');
    console.log('Clip verified deleted from database.');

    console.log('\n--- Verification completed successfully! All checks passed. ---');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up test database documents...');
    if (userA) await User.deleteOne({ _id: userA._id });
    if (userB) await User.deleteOne({ _id: userB._id });
    if (testMovie) await Movie.deleteOne({ _id: testMovie._id });
    if (testCast) await Cast.deleteOne({ _id: testCast._id });
    if (testClip) await Clip.deleteOne({ _id: testClip._id });

    console.log('Disconnecting from database...');
    await mongoose.connection.close();
    console.log('Finished.');
  }
}

runTests();
