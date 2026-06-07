require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Comment = require('./models/Comment');
const connectDB = require('./config/db');

async function runTests() {
  console.log('Connecting to database...');
  await connectDB();

  let testUser = null;
  let testAdmin = null;
  let testMovie = null;
  let testComment = null;

  try {
    // 1. Create a Test User and Test Admin
    console.log('Creating test users...');
    testUser = new User({
      name: 'Regular User',
      email: 'user_' + Date.now() + '@example.com',
      passwordHash: 'dummy_hash',
      role: 'user'
    });
    await testUser.save();

    testAdmin = new User({
      name: 'Admin User',
      email: 'admin_' + Date.now() + '@example.com',
      passwordHash: 'dummy_hash',
      role: 'admin'
    });
    await testAdmin.save();

    // 2. Create a Test Movie
    testMovie = new Movie({
      title: 'Dune: Part Two (Test)',
      mediaType: 'movie',
      language: 'English',
      status: 'released',
      synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking revenge.'
    });
    await testMovie.save();

    console.log('Test setup complete.');

    // ----------------------------------------------------
    // TEST 1: Comment Max Length Enforcement (1000 chars)
    // ----------------------------------------------------
    console.log('\n--- Test 1: Add Comment with > 1000 Characters (Should Fail 400) ---');
    const commentsController = require('./controllers/commentsController');
    const longText = 'a'.repeat(1001);

    const createMockReqRes = (user, params = {}, body = {}, query = {}) => {
      return {
        req: { user: { id: user._id.toString(), role: user.role }, params, body, query },
        res: {
          statusCode: 200,
          status(code) { this.statusCode = code; return this; },
          json(data) { this.data = data; return this; }
        }
      };
    };

    let { req, res } = createMockReqRes(testUser, {}, {
      entityType: 'movie',
      entityId: testMovie._id.toString(),
      text: longText
    });

    await commentsController.addComment(req, res);
    console.log('Add comment status:', res.statusCode, 'message:', res.data.message);
    if (res.statusCode !== 400 || !res.data.message.includes('cannot exceed 1000 characters')) {
      throw new Error('Should have failed with 400 character limit warning');
    }

    console.log('\n--- Test 1b: Update Comment with > 1000 Characters (Should Fail 400) ---');
    // Save a valid comment first
    testComment = new Comment({
      userId: testUser._id,
      entityType: 'movie',
      entityId: testMovie._id,
      text: 'Valid short comment'
    });
    await testComment.save();

    ({ req, res } = createMockReqRes(testUser, { id: testComment._id.toString() }, { text: longText }));
    await commentsController.updateComment(req, res);
    console.log('Update comment status:', res.statusCode, 'message:', res.data.message);
    if (res.statusCode !== 400 || !res.data.message.includes('cannot exceed 1000 characters')) {
      throw new Error('Update should have failed with 400 character limit warning');
    }

    // ----------------------------------------------------
    // TEST 2: AI Explanation Re-trigger Guard (REMOVED: User requested to allow all authenticated triggers)
    // ----------------------------------------------------

    // ----------------------------------------------------
    // TEST 3: Live API failure / Fallback Recovery
    // ----------------------------------------------------
    console.log('\n--- Test 3: Gemini Failure Graceful Fallback ---');
    const movieController = require('./controllers/movieController');
    
    // Temporarily mess up the API key in environment to force Gemini failure
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'invalid_key_to_force_failure';

    // Clear explanation to pass the re-trigger guard
    testMovie.explanation = undefined;
    testMovie.explanationGeneratedAt = undefined;
    await testMovie.save();

    // Trigger generator as admin (since we want it to run without guard)
    console.log('Triggering explanation with invalid API key as Admin...');
    ({ req, res } = createMockReqRes(testAdmin, { id: testMovie._id.toString() }));
    await movieController.generateExplanation(req, res);
    console.log('Response status:', res.statusCode, 'message:', res.data.message);
    console.log('Is Fallback:', res.data.isFallback);
    console.log('Generated Explanation (Preview):', res.data.explanation.slice(0, 100) + '...');
    
    // Restore API key
    process.env.GEMINI_API_KEY = originalApiKey;

    if (!res.data.isFallback || !res.data.explanation.includes('Local Profile')) {
      throw new Error('Should have successfully fallen back to local profile');
    }

    console.log('\n✅ All bug fixes and fallback mechanisms validated successfully!');
  } catch (error) {
    console.error('\n❌ Validation Test Failed:', error);
  } finally {
    console.log('\nCleaning up test documents...');
    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (testAdmin) await User.deleteOne({ _id: testAdmin._id });
    if (testMovie) await Movie.deleteOne({ _id: testMovie._id });
    if (testComment) await Comment.deleteOne({ _id: testComment._id });

    console.log('Closing database connection...');
    await mongoose.connection.close();
    console.log('Done.');
  }
}

runTests();
