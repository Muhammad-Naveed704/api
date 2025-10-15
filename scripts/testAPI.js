const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
require('dotenv').config();

async function testAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Check if admin exists
    const adminUser = await User.findOne({ role: 'admin' });
    console.log('👤 Admin user:', adminUser ? `✅ ${adminUser.email}` : '❌ Not found');

    // Test 2: Check products count
    const productCount = await Product.countDocuments();
    console.log('📦 Total products:', productCount);

    // Test 3: Check active products
    const activeProducts = await Product.countDocuments({ isActive: true });
    console.log('✅ Active products:', activeProducts);

    // Test 4: Check featured products
    const featuredProducts = await Product.countDocuments({ isFeatured: true });
    console.log('⭐ Featured products:', featuredProducts);

    // Test 5: Check categories
    const categories = await Product.distinct('category');
    console.log('📂 Categories:', categories);

    // Test 6: Check colours
    const colours = await Product.distinct('colour');
    console.log('🎨 Colours:', colours);

    // Test 7: Check sizes
    const sizes = await Product.distinct('size');
    console.log('📏 Sizes:', sizes);

    // Test 8: Sample product query
    const sampleProduct = await Product.findOne({ isActive: true });
    if (sampleProduct) {
      console.log('🔍 Sample product:');
      console.log(`   Name: ${sampleProduct.name}`);
      console.log(`   Slug: ${sampleProduct.slug}`);
      console.log(`   Price: $${sampleProduct.price}`);
      console.log(`   Variant: ${sampleProduct.colour}/${sampleProduct.size}`);
      console.log(`   Stock: ${sampleProduct.totalStock} (Sold: ${sampleProduct.soldCount})`);
      console.log(`   Images: ${sampleProduct.images.length}`);
    }

    console.log('\n🎉 API Test Complete!');
    console.log('\n🚀 Ready to start servers:');
    console.log('   Backend: cd backend && npm run dev');
    console.log('   Frontend: cd frontend && npm start');

  } catch (error) {
    console.error('❌ Error testing API:', error);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testAPI();
