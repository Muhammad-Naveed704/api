const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Permission name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Permission description is required'],
    trim: true
  },
  route: {
    type: String,
    required: [true, 'Route is required'],
    trim: true
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'],
    default: 'ALL'
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['products', 'orders', 'users', 'dashboard', 'settings', 'cart', 'profile'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
permissionSchema.index({ name: 1 });
permissionSchema.index({ category: 1 });
permissionSchema.index({ isActive: 1 });

module.exports = mongoose.model('Permission', permissionSchema);

