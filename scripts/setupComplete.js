const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
require('dotenv').config();

// Sample products with different variants
const sampleProducts = [
  // T-Shirt Variants
  {
    name: "Premium Cotton T-Shirt",
    description: "High-quality cotton t-shirt with premium fabric and comfortable fit. Perfect for casual wear and everyday comfort. Made from 100% organic cotton with reinforced stitching for durability. Breathable fabric keeps you cool and comfortable all day long.",
    tags: ["t-shirt", "cotton", "casual", "premium", "organic"],
    price: 29.99,
    colour: "black",
    size: "sm",
    category: "clothing",
    totalStock: 50,
    soldCount: 8,
    isFeatured: true,
    images: ["/uploads/products/tshirt-black-sm-1.jpg", "/uploads/products/tshirt-black-sm-2.jpg"]
  },
  {
    name: "Premium Cotton T-Shirt",
    description: "High-quality cotton t-shirt with premium fabric and comfortable fit. Perfect for casual wear and everyday comfort. Made from 100% organic cotton with reinforced stitching for durability. Breathable fabric keeps you cool and comfortable all day long.",
    tags: ["t-shirt", "cotton", "casual", "premium", "organic"],
    price: 29.99,
    colour: "black",
    size: "md",
    category: "clothing",
    totalStock: 100,
    soldCount: 25,
    isFeatured: true,
    images: ["/uploads/products/tshirt-black-md-1.jpg", "/uploads/products/tshirt-black-md-2.jpg"]
  },
  {
    name: "Premium Cotton T-Shirt",
    description: "High-quality cotton t-shirt with premium fabric and comfortable fit. Perfect for casual wear and everyday comfort. Made from 100% organic cotton with reinforced stitching for durability. Breathable fabric keeps you cool and comfortable all day long.",
    tags: ["t-shirt", "cotton", "casual", "premium", "organic"],
    price: 29.99,
    colour: "white",
    size: "md",
    category: "clothing",
    totalStock: 80,
    soldCount: 20,
    isFeatured: true,
    images: ["/uploads/products/tshirt-white-md-1.jpg", "/uploads/products/tshirt-white-md-2.jpg"]
  },
  {
    name: "Premium Cotton T-Shirt",
    description: "High-quality cotton t-shirt with premium fabric and comfortable fit. Perfect for casual wear and everyday comfort. Made from 100% organic cotton with reinforced stitching for durability. Breathable fabric keeps you cool and comfortable all day long.",
    tags: ["t-shirt", "cotton", "casual", "premium", "organic"],
    price: 29.99,
    colour: "red",
    size: "lg",
    category: "clothing",
    totalStock: 60,
    soldCount: 15,
    isFeatured: false,
    images: ["/uploads/products/tshirt-red-lg-1.jpg", "/uploads/products/tshirt-red-lg-2.jpg"]
  },

  // Electronics
  {
    name: "Wireless Bluetooth Headphones",
    description: "Premium wireless headphones with active noise cancellation technology. Enjoy crystal-clear audio quality with up to 30 hours of battery life. Perfect for music lovers, professionals, and commuters.",
    tags: ["headphones", "wireless", "bluetooth", "audio", "music", "noise-cancellation"],
    price: 199.99,
    colour: "black",
    size: "md",
    category: "electronics",
    totalStock: 40,
    soldCount: 35,
    isFeatured: true,
    images: ["/uploads/products/headphones-black-1.jpg", "/uploads/products/headphones-black-2.jpg"]
  },
  {
    name: "Smart Fitness Watch",
    description: "Advanced fitness tracking watch with heart rate monitoring, GPS, and smartphone connectivity. Track your workouts, monitor your health, and stay connected on the go. Water-resistant design perfect for all activities.",
    tags: ["watch", "fitness", "smart", "health", "tracking", "gps"],
    price: 299.99,
    colour: "black",
    size: "md",
    category: "electronics",
    totalStock: 25,
    soldCount: 18,
    isFeatured: true,
    images: ["/uploads/products/smartwatch-black-1.jpg", "/uploads/products/smartwatch-black-2.jpg"]
  },
  {
    name: "Portable Phone Charger",
    description: "High-capacity 20,000mAh portable power bank with fast charging technology. Compatible with all smartphones and tablets. Compact design perfect for travel and daily use. Multiple charging ports for convenience.",
    tags: ["charger", "portable", "power-bank", "electronics", "mobile", "fast-charging"],
    price: 49.99,
    colour: "white",
    size: "sm",
    category: "electronics",
    totalStock: 80,
    soldCount: 45,
    isFeatured: false,
    images: ["/uploads/products/powerbank-white-1.jpg", "/uploads/products/powerbank-white-2.jpg"]
  },

  // Sports & Accessories
  {
    name: "Running Sneakers",
    description: "Lightweight running shoes designed for comfort and performance. Breathable mesh upper with responsive cushioning for all-day comfort during workouts and daily activities. Durable outsole for long-lasting wear.",
    tags: ["shoes", "running", "sneakers", "sports", "comfort", "breathable"],
    price: 129.99,
    colour: "white",
    size: "lg",
    category: "sports",
    totalStock: 35,
    soldCount: 22,
    isFeatured: true,
    images: ["/uploads/products/sneakers-white-lg-1.jpg", "/uploads/products/sneakers-white-lg-2.jpg"]
  },
  {
    name: "Leather Wallet",
    description: "Genuine leather wallet with RFID blocking technology. Multiple card slots and bill compartments for organized storage. Handcrafted with attention to detail and premium materials.",
    tags: ["wallet", "leather", "accessories", "rfid", "premium", "handcrafted"],
    price: 59.99,
    colour: "brown",
    size: "sm",
    category: "accessories",
    totalStock: 50,
    soldCount: 30,
    isFeatured: false,
    images: ["/uploads/products/wallet-brown-1.jpg", "/uploads/products/wallet-brown-2.jpg"]
  },
  {
    name: "Designer Sunglasses",
    description: "Stylish designer sunglasses with UV protection and polarized lenses. Classic aviator style that complements any face shape. Premium metal frame with comfortable nose pads and adjustable temples.",
    tags: ["sunglasses", "designer", "uv-protection", "aviator", "fashion", "polarized"],
    price: 149.99,
    colour: "gold",
    size: "md",
    category: "accessories",
    totalStock: 30,
    soldCount: 12,
    isFeatured: true,
    images: ["/uploads/products/sunglasses-gold-1.jpg", "/uploads/products/sunglasses-gold-2.jpg"]
  },

  // Home & Lifestyle
  {
    name: "Coffee Mug Set",
    description: "Set of 4 ceramic coffee mugs with ergonomic handles. Microwave and dishwasher safe. Perfect for enjoying your morning coffee or tea. Modern minimalist design that fits any kitchen decor.",
    tags: ["mug", "coffee", "ceramic", "kitchen", "set", "microwave-safe"],
    price: 34.99,
    colour: "white",
    size: "md",
    category: "home",
    totalStock: 40,
    soldCount: 15,
    isFeatured: false,
    images: ["/uploads/products/coffeemug-white-1.jpg", "/uploads/products/coffeemug-white-2.jpg"]
  },
  {
    name: "Yoga Mat",
    description: "Non-slip yoga mat made from eco-friendly TPE materials. Perfect thickness for comfort and stability during yoga practice. Easy to clean and store with carrying strap included. Ideal for all yoga styles.",
    tags: ["yoga", "mat", "fitness", "exercise", "eco-friendly", "non-slip"],
    price: 39.99,
    colour: "purple",
    size: "lg",
    category: "sports",
    totalStock: 45,
    soldCount: 18,
    isFeatured: false,
    images: ["/uploads/products/yogamat-purple-1.jpg", "/uploads/products/yogamat-purple-2.jpg"]
  },

  // More Electronics
  {
    name: "Bluetooth Speaker",
    description: "Portable Bluetooth speaker with 360-degree sound and waterproof design. Perfect for outdoor adventures, pool parties, and home entertainment. 12-hour battery life with deep bass and clear highs.",
    tags: ["speaker", "bluetooth", "portable", "waterproof", "audio", "360-sound"],
    price: 89.99,
    colour: "blue",
    size: "md",
    category: "electronics",
    totalStock: 35,
    soldCount: 28,
    isFeatured: true,
    images: ["/uploads/products/speaker-blue-1.jpg", "/uploads/products/speaker-blue-2.jpg"]
  },
  {
    name: "Gaming Mouse",
    description: "High-precision gaming mouse with customizable RGB lighting and programmable buttons. Ergonomic design for extended gaming sessions. Adjustable DPI settings for different gaming scenarios.",
    tags: ["mouse", "gaming", "rgb", "precision", "ergonomic", "programmable"],
    price: 79.99,
    colour: "black",
    size: "md",
    category: "electronics",
    totalStock: 60,
    soldCount: 35,
    isFeatured: false,
    images: ["/uploads/products/gaming-mouse-black-1.jpg", "/uploads/products/gaming-mouse-black-2.jpg"]
  }
];

async function setupCompleteStore() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(' Connected to MongoDB');

    // Step 1: Create admin user if doesn't exist
    let adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('👤 Creating admin user...');
      adminUser = new User({
        name: 'Arrak Admin',
        email: 'admin@Arrak.com',
        password: 'Admin123!',
        role: 'admin',
        isActive: true,
        isEmailVerified: true
      });
      await adminUser.save();
      console.log(' Admin user created!');
      console.log(' Email: admin@Arrak.com');
      console.log(' Password: Admin123!');
    } else {
      console.log(' Admin user already exists:', adminUser.email);
    }

    // Step 2: Clear existing products
    const existingCount = await Product.countDocuments();
    if (existingCount > 0) {
      console.log(` Clearing ${existingCount} existing products...`);
      await Product.deleteMany({});
    }

    // Step 3: Add sample products with unique slugs
    console.log(' Adding sample products...');
    const productsWithCreator = sampleProducts.map((product, index) => {
      const baseSlug = product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      return {
        ...product,
        slug: `${baseSlug}-${product.colour}-${product.size}-${index}`, // Ensure unique slugs
        createdBy: adminUser._id
      };
    });

    const insertedProducts = await Product.insertMany(productsWithCreator);
    console.log(` Added ${insertedProducts.length} sample products!`);

    // Step 4: Show statistics
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
          totalStock: { $sum: '$totalStock' },
          totalSold: { $sum: '$soldCount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n Store Statistics:');
    const stat = stats[0];
    console.log(`   Total Products: ${stat.totalProducts}`);
    console.log(`   Total Inventory Value: $${stat.totalValue.toFixed(2)}`);
    console.log(`   Total Stock: ${stat.totalStock} items`);
    console.log(`   Total Sold: ${stat.totalSold} items`);
    console.log(`   Featured Products: ${stat.featuredCount}`);

    console.log('\n Category Breakdown:');
    categoryStats.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.count} products (Stock: ${cat.totalStock}, Sold: ${cat.totalSold})`);
    });

    console.log('\n Complete Arrak store setup finished!');
    console.log('\n Next Steps:');
    console.log('   1. Start the backend server: cd backend && npm run dev');
    console.log('   2. Start the frontend: cd frontend && npm start');
    console.log('   3. Login as admin: http://localhost:3000/login');
    console.log('      Email: admin@Arrak.com');
    console.log('      Password: Admin123!');
    console.log('   4. Access admin panel: http://localhost:3000/admin/products');
    console.log('   5. View products: http://localhost:3000/products');

    console.log('\n🔧 Available Features:');
    console.log(' Complete CRUD for products (admin only)');
    console.log(' Product variants (colour/size combinations)');
    console.log(' Multiple image upload support');
    console.log(' Advanced filtering (category, tags, price, colour, size)');
    console.log(' Sorting (trending, popularity, price low-high, price high-low)');
    console.log(' Pagination (12 products per page)');
    console.log(' Slug-based product URLs');
    console.log(' Add to cart with variant support');
    console.log(' Simple checkout with order summary');

  } catch (error) {
    console.error('❌ Error setting up store:', error);
    if (error.code === 11000) {
      console.log('💡 Some data may already exist. This is normal.');
    }
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the complete setup
setupCompleteStore();
