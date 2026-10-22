require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const axios = require('axios');
const { Resend } = require('resend');
const IntaSend = require('intasend-node');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// --- SECURITY MIDDLEWARE ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Securely'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- DATABASE SCHEMA ---
const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  itemName: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['crypto', 'mpesa'], required: true },
  status: { type: String, default: 'pending' },
  contactInfo: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// --- ROUTE 1: NOWPAYMENTS (CRYPTO) ---
app.post('/api/pay/crypto', async (req, res) => {
  const { itemName, amount, email } = req.body;

  try {
    const orderId = 'ORD-' + Date.now();
    
    // Save to DB
    const newOrder = new Order({ orderId, itemName, amount, paymentMethod: 'crypto', contactInfo: email });
    await newOrder.save();

    // Call NOWPayments
    const response = await axios.post('https://api.nowpayments.io/v1/invoice', {
      price_amount: amount,
      price_currency: 'usd',
      order_id: orderId,
      order_description: itemName,
      // Change to your live domain later
      success_url: `https://ai-mastery-hub-o18y.onrender.com/?payment=success&orderId=${orderId}`,
      cancel_url: `https://ai-mastery-hub-o18y.onrender.com/`
    }, {
      headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY }
    });

    res.json({ invoice_url: response.data.invoice_url });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create crypto invoice' });
  }
});

// --- ROUTE 2: INTASEND (M-PESA) ---
app.post('/api/pay/mpesa', async (req, res) => {
  const { itemName, amount, phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required for M-Pesa.' });
  }

  try {
    const orderId = 'ORD-' + Date.now();
    
    const newOrder = new Order({ orderId, itemName, amount, paymentMethod: 'mpesa', contactInfo: phone });
    await newOrder.save();

    // Initialize IntaSend
    const intasend = new IntaSend(
      process.env.INTASEND_PUBLISHABLE_KEY,
      process.env.INTASEND_SECRET_KEY,
      process.env.INTASEND_TEST_MODE === 'true'
    );

    // Convert USD to KES (Assuming 130 KES = 1 USD)
    const amountInKES = Math.round(amount * 130);

    // Send STK Push
    const response = await intasend.collection().mpesaStkPush({
      first_name: "Customer",
      last_name: "Order",
      email: "customer@example.com", 
      host: req.get('host'),
      amount: amountInKES,
      phone_number: phone,
      api_ref: orderId,
      narrative: itemName
    });

    console.log(`[INTASEND] STK Push sent to ${phone}:`, response);

    res.json({ success: true, message: 'Check your phone to enter M-Pesa PIN.', orderId });
  } catch (error) {
    console.error('IntaSend Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to initiate M-Pesa payment' });
  }
});

// --- ROUTE 3: CONTACT FORM ---
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'daims448@gmail.com',
      reply_to: email,
      subject: `New AI Mastery Hub Message from ${name}`,
      html: `<p>${message}</p>`
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Email failed' });
  }
});

// Serve Frontend
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
