const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGODB_URI);

// Create default admin and principal accounts
const createDefaultAccounts = async () => {
  try {
    console.log('Checking for default accounts...');

    // Check if admin account exists
    const adminExists = await User.findOne({
      role: 'admin',
      isSystemAccount: true
    });

    if (!adminExists) {
      console.log('Creating default admin account...');
      await User.create({
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@schoolms.com',
        password: 'admin123',
        role: 'admin',
        status: 'active',
        isApproved: true,
        isSystemAccount: true
      });
      console.log('Default admin account created');
    } else {
      console.log('Default admin account already exists');
    }

    // Check if principal account exists
    const principalExists = await User.findOne({
      role: 'principal',
      isSystemAccount: true
    });

    if (!principalExists) {
      console.log('Creating default principal account...');
      await User.create({
        firstName: 'School',
        lastName: 'Principal',
        email: 'principal@schoolms.com',
        password: 'principal123',
        role: 'principal',
        status: 'active',
        isApproved: true,
        isSystemAccount: true
      });
      console.log('Default principal account created');
    } else {
      console.log('Default principal account already exists');
    }

    console.log('Default accounts check completed');
  } catch (err) {
    console.error('Error creating default accounts:', err);
  }
};

module.exports = { createDefaultAccounts };
