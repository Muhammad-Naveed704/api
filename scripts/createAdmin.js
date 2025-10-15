const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(' Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log(' Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    const adminData = {
      name: 'Arrak Admin',
      email: 'admin@Arrak.com',
      password: 'Admin123!',
      role: 'admin',
      isActive: true,
      isEmailVerified: true
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('Admin user created successfully!');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);
    console.log('Please change the password after first login!');

  } catch (error) {
    console.error(' Error creating admin user:', error);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createAdminUser();
