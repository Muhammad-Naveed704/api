const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
require('dotenv').config();

const sampleProducts = [
  {
    name: "Premium Black T-Shirt",
    description: "High-quality cotton t-shirt with premium fabric and comfortable fit. Perfect for casual wear and everyday comfort. Made from 100% organic cotton with reinforced stitching for durability.",
    tags: ["t-shirt", "cotton", "casual", "premium", "black"],
    price: 29.99,
    colour: "black",
    size: "md",
    category: "clothing",
    totalStock: 100,
    soldCount: 15,
    isFeatured: true,
    images: ["/uploads/products/black-tshirt-1.jpg", "/uploads/products/black-tshirt-2.jpg"]
  },
  {
    name: "Premium Black T-Shirt",
    description: "High-quality cotton t-shirt with premium fabric and comfortable fit. Perfect for casual wear and everyday comfort. Made from 100% organic cotton with reinforced stitching for durability.",
    tags: ["t-shirt", "cotton", "casual", "premium", "black"],
    price: 29.99,
    colour: "black",
    size: "lg",
    category: "clothing",
    totalStock: 80,
    soldCount: 12,
    isFeatured: true,
    images: ["/uploads/products/black-tshirt-1.jpg", "/uploads/products/black-tshirt-2.jpg"]
  },
  {
    name: "Premium White T-Shirt",
    description: "Classic white t-shirt made from premium cotton blend. Versatile design that works with any outfit. Pre-shrunk fabric ensures perfect fit wash after wash.",
    tags: ["t-shirt", "cotton", "casual", "premium", "white"],
    price: 29.99,
    colour: "white",
    size: "md",
    category: "clothing",
    totalStock: 90,
    soldCount: 20,
    isFeatured: true,
    images: ["/uploads/products/white-tshirt-1.jpg", "/uploads/products/white-tshirt-2.jpg"]
  },
  {
    name: "Premium White T-Shirt",
    description: "Classic white t-shirt made from premium cotton blend. Versatile design that works with any outfit. Pre-shrunk fabric ensures perfect fit wash after wash.",
    tags: ["t-shirt", "cotton", "casual", "premium", "white"],
    price: 29.99,
    colour: "white",
    size: "lg",
    category: "clothing",
    totalStock: 75,
    soldCount: 18,
    isFeatured: true,
    images: ["/uploads/products/white-tshirt-1.jpg", "/uploads/products/white-tshirt-2.jpg"]
  },
  {
    name: "Wireless Bluetooth Headphones",
    description: "Premium wireless headphones with noise cancellation technology. Enjoy crystal-clear audio quality with up to 30 hours of battery life. Perfect for music lovers and professionals.",
    tags: ["headphones", "wireless", "bluetooth", "audio", "music"],
    price: 199.99,
    colour: "black",
    size: "md",
    category: "electronics",
    totalStock: 50,
    soldCount: 35,
    isFeatured: true,
    images: ["/uploads/products/headphones-1.jpg", "/uploads/products/headphones-2.jpg"]
  },
  {
    name: "Smart Fitness Watch",
    description: "Advanced fitness tracking watch with heart rate monitoring, GPS, and smartphone connectivity. Track your workouts, monitor your health, and stay connected on the go.",
    tags: ["watch", "fitness", "smart", "health", "tracking"],
    price: 299.99,
    colour: "black",
    size: "md",
    category: "electronics",
    totalStock: 30,
    soldCount: 25,
    isFeatured: true,
    images: ["/uploads/products/smartwatch-1.jpg", "/uploads/products/smartwatch-2.jpg"]
  },
  {
    name: "Casual Denim Jeans",
    description: "Comfortable straight-fit denim jeans made from premium denim fabric. Classic design with modern comfort features. Perfect for everyday wear and casual occasions.",
    tags: ["jeans", "denim", "casual", "pants", "blue"],
    price: 79.99,
    colour: "blue",
    size: "lg",
    category: "clothing",
    totalStock: 60,
    soldCount: 8,
    isFeatured: false,
    images: ["/uploads/products/jeans-1.jpg", "/uploads/products/jeans-2.jpg"]
  },
  {
    name: "Running Sneakers",
    description: "Lightweight running shoes designed for comfort and performance. Breathable mesh upper with responsive cushioning for all-day comfort during workouts and daily activities.",
    tags: ["shoes", "running", "sneakers", "sports", "comfort"],
    price: 129.99,
    colour: "white",
    size: "lg",
    category: "sports",
    totalStock: 40,
    soldCount: 22,
    isFeatured: true,
    images: ["/uploads/products/sneakers-1.jpg", "/uploads/products/sneakers-2.jpg"]
  },
  {
    name: "Leather Wallet",
    description: "Genuine leather wallet with RFID blocking technology. Multiple card slots and bill compartments for organized storage. Handcrafted with attention to detail.",
    tags: ["wallet", "leather", "accessories", "rfid", "premium"],
    price: 59.99,
    colour: "brown",
    size: "sm",
    category: "accessories",
    totalStock: 70,
    soldCount: 30,
    isFeatured: false,
    images: ["/uploads/products/wallet-1.jpg", "/uploads/products/wallet-2.jpg"]
  },
  {
    name: "Portable Phone Charger",
    description: "High-capacity portable power bank with fast charging technology. Compatible with all smartphones and tablets. Compact design perfect for travel and daily use.",
    tags: ["charger", "portable", "power-bank", "electronics", "mobile"],
    price: 49.99,
    colour: "black",
    size: "sm",
    category: "electronics",
    totalStock: 120,
    soldCount: 45,
    isFeatured: false,
    images: ["/uploads/products/powerbank-1.jpg", "/uploads/products/powerbank-2.jpg"]
  },
  {
    name: "Designer Sunglasses",
    description: "Stylish designer sunglasses with UV protection and polarized lenses. Classic aviator style that complements any face shape. Premium metal frame with comfortable nose pads.",
    tags: ["sunglasses", "designer", "uv-protection", "aviator", "fashion"],
    price: 149.99,
    colour: "gold",
    size: "md",
    category: "accessories",
    totalStock: 35,
    soldCount: 18,
    isFeatured: true,
    images: ["/uploads/products/sunglasses-1.jpg", "/uploads/products/sunglasses-2.jpg"]
  },
  {
    name: "Yoga Mat",
    description: "Non-slip yoga mat made from eco-friendly materials. Perfect thickness for comfort and stability during yoga practice. Easy to clean and store with carrying strap included.",
    tags: ["yoga", "mat", "fitness", "exercise", "eco-friendly"],
    price: 39.99,
    colour: "purple",
    size: "lg",
    category: "sports",
    totalStock: 60,
    soldCount: 25,
    isFeatured: false,
    images: ["/uploads/products/yogamat-1.jpg", "/uploads/products/yogamat-2.jpg"]
  },
  {
    name: "Coffee Mug Set",
    description: "Set of 4 ceramic coffee mugs with ergonomic handles. Microwave and dishwasher safe. Perfect for enjoying your morning coffee or tea. Modern minimalist design.",
    tags: ["mug", "coffee", "ceramic", "kitchen", "set"],
    price: 34.99,
    colour: "white",
    size: "md",
    category: "home",
    totalStock: 50,
    soldCount: 15,
    isFeatured: false,
    images: ["/uploads/products/coffeemug-1.jpg", "/uploads/products/coffeemug-2.jpg"]
  },
  {
    name: "Desk Organizer",
    description: "Bamboo desk organizer with multiple compartments for pens, papers, and office supplies. Sustainable and stylish solution for keeping your workspace tidy and organized.",
    tags: ["organizer", "desk", "bamboo", "office", "storage"],
    price: 45.99,
    colour: "brown",
    size: "lg",
    category: "home",
    totalStock: 40,
    soldCount: 12,
    isFeatured: false,
    images: ["/uploads/products/organizer-1.jpg", "/uploads/products/organizer-2.jpg"]
  },
  {
    name: "Bluetooth Speaker",
    description: "Portable Bluetooth speaker with 360-degree sound and waterproof design. Perfect for outdoor adventures, pool parties, and home entertainment. 12-hour battery life.",
    tags: ["speaker", "bluetooth", "portable", "waterproof", "audio"],
    price: 89.99,
    colour: "blue",
    size: "md",
    category: "electronics",
    totalStock: 45,
    soldCount: 28,
    isFeatured: true,
    images: ["/uploads/products/speaker-1.jpg", "/uploads/products/speaker-2.jpg"]
  }
];

async function addSampleProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find an admin user to set as creator
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      console.log('💡 Steps to create admin:');
      console.log('   1. Register a user at http://localhost:3000/register');
      console.log('   2. Update role in MongoDB: db.users.updateOne({email: "your-email"}, {$set: {role: "admin"}})');
      return;
    }

    console.log(`📝 Using admin user: ${adminUser.email} as product creator`);

    // Clear existing products (optional)
    const existingCount = await Product.countDocuments();
    if (existingCount > 0) {
      console.log(`🗑️ Found ${existingCount} existing products. Clearing...`);
      await Product.deleteMany({});
    }

    // Add createdBy to all products and generate unique slugs
    const productsWithCreator = sampleProducts.map((product, index) => {
      const baseSlug = product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      return {
        ...product,
        slug: `${baseSlug}-${product.colour}-${product.size}`, // Unique slug for each variant
        createdBy: adminUser._id
      };
    });

    // Insert sample products
    const insertedProducts = await Product.insertMany(productsWithCreator);
    console.log(`✅ Added ${insertedProducts.length} sample products:`);
    
    insertedProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (${product.colour}/${product.size}) - $${product.price} - Stock: ${product.totalStock} - Sold: ${product.soldCount}`);
    });

    // Show statistics
    const stats = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$price', '$totalStock'] } },
          totalStock: { $sum: '$totalStock' },
          totalSold: { $sum: '$soldCount' },
          featuredCount: { $sum: { $cond: ['$isFeatured', 1, 0] } }
        }
      }
    ]);

    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$totalStock' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Product Statistics:');
    const stat = stats[0];
    console.log(`   Total Products: ${stat.totalProducts}`);
    console.log(`   Total Inventory Value: $${stat.totalValue.toFixed(2)}`);
    console.log(`   Total Stock: ${stat.totalStock} items`);
    console.log(`   Total Sold: ${stat.totalSold} items`);
    console.log(`   Featured Products: ${stat.featuredCount}`);

    console.log('\n📈 Category Breakdown:');
    categoryStats.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.count} products (${cat.totalStock} items)`);
    });

    console.log('\n🎉 Sample products added successfully!');
    console.log('🌐 You can now view them at:');
    console.log('   - User view: http://localhost:3000/products');
    console.log('   - Admin view: http://localhost:3000/admin/products');
    console.log('\n🔧 Available API endpoints:');
    console.log('   - GET /api/products (with filters: category, tags, price, colour, size)');
    console.log('   - GET /api/products/slug/:slug');
    console.log('   - GET /api/products/trending');
    console.log('   - GET /api/products/featured');
    console.log('   - POST /api/admin/products (admin only)');
    console.log('   - PUT /api/admin/products/:id (admin only)');
    console.log('   - DELETE /api/admin/products/:id (admin only)');

  } catch (error) {
    console.error('❌ Error adding products:', error);
    if (error.code === 11000) {
      console.log('💡 Duplicate key error. Some products may already exist.');
    }
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
addSampleProducts();