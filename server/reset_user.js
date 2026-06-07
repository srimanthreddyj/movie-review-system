require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

async function run() {
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Reset sam@gmail.com password to 'password123'
    let sam = await User.findOne({ email: 'sam@gmail.com' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    if (sam) {
      sam.passwordHash = passwordHash;
      await sam.save();
      console.log('Successfully reset password of sam@gmail.com to "password123".');
    } else {
      sam = new User({
        name: 'sam',
        email: 'sam@gmail.com',
        passwordHash,
        role: 'user'
      });
      await sam.save();
      console.log('Successfully created user sam@gmail.com with password "password123".');
    }

    // 2. Create/Reset admin@gmail.com to 'password123'
    let admin = await User.findOne({ email: 'admin@gmail.com' });
    if (admin) {
      admin.passwordHash = passwordHash;
      admin.role = 'admin';
      await admin.save();
      console.log('Successfully reset password of admin@gmail.com to "password123".');
    } else {
      admin = new User({
        name: 'Admin User',
        email: 'admin@gmail.com',
        passwordHash,
        role: 'admin'
      });
      await admin.save();
      console.log('Successfully created admin user admin@gmail.com with password "password123".');
    }

    console.log('Database sync complete.');
    mongoose.disconnect();
  } catch (err) {
    console.error('Error executing script:', err);
    mongoose.disconnect();
  }
}

run();
