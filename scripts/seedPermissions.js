const mongoose = require('mongoose');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
require('dotenv').config();

const permissions = [
  // Dashboard permissions
  { name: 'view_dashboard', description: 'View admin dashboard', route: '/admin/dashboard', method: 'GET', category: 'dashboard' },
  { name: 'view_stats', description: 'View dashboard statistics', route: '/admin/dashboard/stats', method: 'GET', category: 'dashboard' },
  
  // Product permissions
  { name: 'view_products', description: 'View products list', route: '/admin/products', method: 'GET', category: 'products' },
  { name: 'create_product', description: 'Create new product', route: '/admin/products', method: 'POST', category: 'products' },
  { name: 'edit_product', description: 'Edit existing product', route: '/admin/products/:id', method: 'PUT', category: 'products' },
  { name: 'delete_product', description: 'Delete product', route: '/admin/products/:id', method: 'DELETE', category: 'products' },
  
  // Order permissions
  { name: 'view_orders', description: 'View orders list', route: '/admin/orders', method: 'GET', category: 'orders' },
  { name: 'view_order_details', description: 'View order details', route: '/admin/orders/:id', method: 'GET', category: 'orders' },
  { name: 'update_order_status', description: 'Update order status', route: '/admin/orders/:id/status', method: 'PUT', category: 'orders' },
  { name: 'cancel_order', description: 'Cancel order', route: '/admin/orders/:id/cancel', method: 'POST', category: 'orders' },
  
  // User permissions
  { name: 'view_users', description: 'View users list', route: '/admin/users', method: 'GET', category: 'users' },
  { name: 'create_user', description: 'Create new user', route: '/api/users/create', method: 'POST', category: 'users' },
  { name: 'edit_user', description: 'Edit user details', route: '/api/users/:id', method: 'PUT', category: 'users' },
  { name: 'delete_user', description: 'Delete user', route: '/api/users/:id', method: 'DELETE', category: 'users' },
  { name: 'manage_roles', description: 'Manage user roles', route: '/api/users/:id/role', method: 'PUT', category: 'users' },
  { name: 'manage_permissions', description: 'Manage user permissions', route: '/api/users/:id/permissions', method: 'PUT', category: 'users' },
  
  // Settings permissions
  { name: 'view_settings', description: 'View settings', route: '/admin/settings', method: 'GET', category: 'settings' },
  { name: 'update_settings', description: 'Update settings', route: '/admin/settings', method: 'PUT', category: 'settings' },
  
  // Cart permissions
  { name: 'view_cart', description: 'View shopping cart', route: '/cart', method: 'GET', category: 'cart' },
  { name: 'manage_cart', description: 'Add/remove items from cart', route: '/api/cart', method: 'ALL', category: 'cart' },
  
  // Profile permissions
  { name: 'view_profile', description: 'View own profile', route: '/profile', method: 'GET', category: 'profile' },
  { name: 'edit_profile', description: 'Edit own profile', route: '/api/users/:id', method: 'PUT', category: 'profile' },
];

const roles = [
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access',
    permissions: permissions.map(p => p.name),
    isSystem: true,
    isActive: true
  },
  {
    name: 'manager',
    displayName: 'Manager',
    description: 'Can manage products, orders, and view users',
    permissions: [
      'view_dashboard', 'view_stats',
      'view_products', 'create_product', 'edit_product', 'delete_product',
      'view_orders', 'view_order_details', 'update_order_status', 'cancel_order',
      'view_users',
      'view_settings'
    ],
    isSystem: false,
    isActive: true
  },
  {
    name: 'customer_service',
    displayName: 'Customer Service',
    description: 'Can view and manage orders',
    permissions: [
      'view_dashboard',
      'view_products',
      'view_orders', 'view_order_details', 'update_order_status',
      'view_users'
    ],
    isSystem: false,
    isActive: true
  },
  {
    name: 'inventory_manager',
    displayName: 'Inventory Manager',
    description: 'Can manage products only',
    permissions: [
      'view_dashboard',
      'view_products', 'create_product', 'edit_product', 'delete_product'
    ],
    isSystem: false,
    isActive: true
  },
  {
    name: 'user',
    displayName: 'Regular User',
    description: 'Basic user permissions',
    permissions: [
      'view_cart', 'manage_cart',
      'view_profile', 'edit_profile'
    ],
    isSystem: true,
    isActive: true
  }
];

async function seedPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Arrak', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Clear existing permissions and roles
    await Permission.deleteMany({});
    await Role.deleteMany({});
    
    console.log('🗑️  Cleared existing permissions and roles');

    // Insert permissions
    const insertedPermissions = await Permission.insertMany(permissions);
    console.log(`✅ Created ${insertedPermissions.length} permissions`);

    // Insert roles
    const insertedRoles = await Role.insertMany(roles);
    console.log(`✅ Created ${insertedRoles.length} roles`);

    console.log('\n📋 Created Permissions:');
    permissions.forEach(p => {
      console.log(`   - ${p.name}: ${p.description}`);
    });

    console.log('\n📋 Created Roles:');
    roles.forEach(r => {
      console.log(`   - ${r.name} (${r.displayName}): ${r.permissions.length} permissions`);
    });

    console.log('\n✨ Permission seeding completed successfully!');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    process.exit(1);
  }
}

seedPermissions();

