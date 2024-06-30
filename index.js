require('dotenv').config(); // Load environment variables
const mongoose = require("mongoose");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Category = require("./category");
const User = require("./user");
const Product = require("./product");
const paypal = require('paypal-rest-sdk'); // PayPal SDK
const mpesa = require('mpesa-node'); // M-Pesa SDK
const logger = require('./logger'); // Import logger


const app = express();

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies with extended options
app.use(express.urlencoded({ extended: true }));

// Connect mongoose
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  logger.info("Connected to MongoDB");

  // User Registration API
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check if the email is already registered
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user
      const newUser = new User({ email, password: hashedPassword });
      await newUser.save();

      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      logger.error(`Error registering user: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Login API
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({ token });
    } catch (error) {
      logger.error(`Error logging in user: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Middleware to verify JWT token
  const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (error) {
      logger.error(`Error verifying token: ${error.message}`);
      res.status(401).json({ message: "Unauthorized" });
    }
  };

  // Protected Route - Example
  app.get("/api/protected_route", verifyToken, async (req, res) => {
    res.status(200).json({ message: "This is a protected route" });
  });

  // Post API - Add Product
  app.post("/api/add_product", async (req, res) => {
    try {
      const { pname, pprice, pdesc } = req.body;

      if (!pname ||!pprice ||!pdesc) {
        return res.status(400).json({
          "status_code": 400,
          "message": "All fields are required"
        });
      }

      const product = new Product({ pname, pprice, pdesc });
      await product.save();
      res.status(201).json({
        "status_code": 201,
        "message": "Product added",
        "product": product
      });
    } catch (err) {
      logger.error(`Error adding product: ${err.message}`);
      res.status(500).json({
        "status_code": 500,
        "message": "Internal server error"
      });
    }
  });

  // Get API - Get Products
  app.get("/api/get_product", async (req, res) => {
    try {
      const products = await Product.find();
      res.status(200).json({
        "status_code": 200,
        "products": products
      });
    } catch (err) {
      logger.error(`Error getting products: ${err.message}`);
      res.status(500).json({
        "status_code": 500,
        "message": "Internal server error"
      });
    }
  });

  // Update API (PUT) - Update Product
  app.put("/api/update/:id", async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    const options = { new: true };

    try {
      const product = await Product.findByIdAndUpdate(id, updateData, options);
      if (product) {
        res.status(200).json({
          "status_code": 200,
          "message": "Product updated",
          "product": product
        });
      } else {
        res.status(404).json({
          "status_code": 404,
          "message": "Product not found"
        });
      }
    } catch (err) {
      logger.error(`Error updating product: ${err.message}`);
      res.status(500).json({
        "status_code": 500,
        "message": "Internal server error"
      });
    }
  });

  // Delete API (DELETE)
  app.delete("/api/delete/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const product = await Product.findByIdAndDelete(id);
      if (product) {
        res.status(200).json({
          "status_code": 200,
          "message": "Product deleted"
        });
      } else {
        res.status(404).json({
          "status_code": 404,
          "message": "Product not found"
        });
      }
    } catch (err) {
      logger.error(`Error deleting product: ${err.message}`);
      res.status(500).json({
        "status_code": 500,
        "message": "Internal server"
      });
    }
  });

  // Cart Functionality
  let cart = [];

  const addItem = (id, name, price, quantity) => {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({ id, name, price, quantity });
    }
    return cart;
  };

  const removeItem = (id) => {
    cart = cart.filter(item => item.id !== id);
    return cart;
  };

  const updateItemQuantity = (id, quantity) => {
    const item = cart.find(item => item.id === id);
    if (item) {
      item.quantity = quantity;
      return cart;
    } else {
      return null;
    }
  };

  const getCart = () => {
    return cart;
  };

  // Category APIs

  // Get all categories
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await Category.find();
      res.status(200).json(categories);
    } catch (error) {
      logger.error(`Error getting categories: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add a new category
  app.post('/api/categories', async (req, res) => {
    try {
      const { title, image } = req.body;
      const newCategory = new Category({ title, image });
      await newCategory.save();
      res.status(201).json({ message: "Category added successfully", category: newCategory });
    } catch (error) {
      logger.error(`Error adding category: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update a category
  app.put('/api/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, image } = req.body;
      const updatedCategory = await Category.findByIdAndUpdate(id, { title, image }, { new: true });
      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
    } catch (error) {
      logger.error(`Error updating category: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a category
  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deletedCategory = await Category.findByIdAndDelete(id);
      if (!deletedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
      logger.error(`Error deleting category: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Cart APIs

  // Add item to cart
  app.post('/api/cart/add', (req, res) => {
    const { id, name, price, quantity } = req.body;
    const updatedCart = addItem(id, name, price, quantity);
    res.status(200).json(updatedCart);
  });

  // Remove item from cart
  app.delete('/api/cart/remove/:id', (req, res) => {
    const { id } = req.params;
    const updatedCart = removeItem(id);
    res.status(200).json(updatedCart);
  });

  // Update item quantity in cart
  app.put('/api/cart/update/:id', (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    const updatedCart = updateItemQuantity(id, quantity);
    if (updatedCart) {
      res.status(200).json(updatedCart);
    } else {
      res.status(404).json({ message: 'Item not found in cart' });
    }
  });

  // Get all items in cart
  app.get('/cart', (req, res) => {
    const cart = getCart();
    res.status(200).json(cart);
  });

  // PayPal configuration
  paypal.configure({
    'mode': 'sandbox', // Change to 'live' for production
    'client_id': process.env.PAYPAL_CLIENT_ID,
    'client_secret': process.env.PAYPAL_CLIENT_SECRET
  });
  
  // Configure M-Pesa
  const payload = {
    businessShortCode: '174379',
    transactionType: 'CustomerPayBillOnline',
    amount: '100', // Replace with the actual amount
    partyA: '254712345678', // Replace with the actual phone number
    partyB: '174379',
    callBackURL: 'https://sandbox.safaricom.co.ke/sandbox/vuwa/rest/MPESA/stkpush/checkbalance',
    accountReference: 'payment',
    phoneNumber: '254712345678', // Replace with the actual phone number
    baseUri: 'https://sandbox.safaricom.co.ke',
    passKey: process.env.MPESA_PASS_KEY,
    transactionDesc: 'Meal Booking',
  };
  
  // Send the request
  app.post('/mpesa/payments', (req, res) => {
    Mpesa.lipaNaMpesaOnline(payload)
    .then((response) => {
        console.log('RESULTS:', response);
        res.status(200).json(response);
      })
    .catch((error) => {
        console.error('Error occurred:', error);
        res.status(500).json({ message: 'Internal server error' });
      });
  });
  
  // Endpoint to handle PayPal payments
  app.post('/paypal/payments', (req, res) => {
    // Handle PayPal payment logic here
  });
  
  // Endpoint to handle M-Pesa payments
  app.post('/mpesa/payments', (req, res) => {
    // Handle M-Pesa payment logic here
  });
  
  // Endpoint to generate payment reports
  app.get('/reports', (req, res) => {
    // Generate and send reports based on payment records
  });

}).catch(err => {
  logger.error(`Error connecting to MongoDB: ${err}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
