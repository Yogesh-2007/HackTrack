const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL || 'admin@hackathon.com' });
    if (!existingAdmin) {
      await Admin.create({
        name: 'Super Admin',
        email: process.env.ADMIN_EMAIL || 'admin@hackathon.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456',
        role: 'superadmin'
      });
      console.log('✅ Default admin created:', process.env.ADMIN_EMAIL || 'admin@hackathon.com');
      console.log('   Password:', process.env.ADMIN_PASSWORD || 'Admin@123456');
      console.log('   ⚠️  Please change the password after first login!');
    }
  } catch (err) {
    console.error('Admin seeder error:', err.message);
  }
};

module.exports = seedAdmin;
