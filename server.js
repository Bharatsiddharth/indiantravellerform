require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');


const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));


// Booking Schema
const bookingSchema = new mongoose.Schema({
    serviceType: String,
    subServiceType: String,
    sourceCity: String,
    route: [{ pickup: String, drop: String }],
    pickupDateTime: Date,
    dropDateTime: Date,
    status: { type: String, default: 'Pending', enum: ['Pending', 'Confirmed', 'Canceled'] },
    contact: {
      name: { type: String, required: true },
      email: { type: String, required: true, match: /.+\@.+\..+/ }, 
      phone: { type: String, required: true, match: /^[0-9]{10}$/ },
    },
    adminAction: {
      action: { type: String, enum: ['Confirmed', 'Canceled'] },
      actionDateTime: Date,
    },
  });

const Booking = mongoose.model('Booking', bookingSchema);

// Routes
// 1. Create Booking
app.post('/api/bookings', async (req, res) => {
    const { serviceType, subServiceType, route, pickupDateTime, dropDateTime, contact } = req.body;
  
    if (!contact || !contact.name || !contact.email || !contact.phone) {
      return res.status(400).json({ message: 'Contact name, email, and phone are required' });
    }
  
    const booking = new Booking({
      serviceType,
      subServiceType,
      route,
      pickupDateTime,
      dropDateTime,
      contact,
    });
  
    try {
      await booking.save();
      res.status(201).json({ message: 'Booking created', booking });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create booking', error: error.message });
    }
  });
  

// 2. Admin Action: Confirm or Cancel
app.put('/api/bookings/:id/action', async (req, res) => {
  const { action } = req.body;
  const validActions = ['Confirmed', 'Canceled'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ message: 'Invalid action' });
  }

  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: action, adminAction: { action, actionDateTime: new Date() } },
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  res.status(200).json({ message: `Booking ${action}`, booking });
});

// 3. Get All Bookings
app.get('/api/bookings', async (req, res) => {
    try {
      const bookings = await Booking.find();
      res.status(200).json({ message: 'All bookings retrieved', bookings });
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve bookings', error: error.message });
    }
  });
  
  // 4. Delete a Booking
  app.delete('/api/bookings/:id', async (req, res) => {
    try {
      const booking = await Booking.findByIdAndDelete(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      res.status(200).json({ message: 'Booking deleted successfully', booking });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete booking', error: error.message });
    }
  });
  

// Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
