require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const emailjs = require('emailjs-com');
const { body, validationResult } = require('express-validator');
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
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
  route: [{ 
      pickup: String, 
      drop: String 
  }],
  pickupDateTime: {
      type: Date,
  },
  dropDateTime: {
    type: Date,
  },
  distance: {
      type: Number,
  },
  status: { 
      type: String, 
      default: 'Pending', 
      enum: ['Pending', 'Confirmed', 'Canceled'] 
  },
  contact: {
      name: { 
          type: String, 
          required: true 
      },
      email: { 
          type: String, 
          required: true, 
          match: /.+\@.+\..+/ 
      }, 
      phone: { 
          type: String, 
          required: true, 
          match: /^[0-9]{10}$/ 
      },
  },
  adminAction: {
      action: { 
          type: String, 
          enum: ['Confirmed', 'Canceled'] 
      },
      driver: {
        name: { type: String, },  
        phone: Number,
        photo: { type: String },
      },
      actionDateTime: Date,
  }
});

const Booking = mongoose.model('Booking', bookingSchema);

// Routes
// 1. Create Booking
app.post('/api/bookings', async (req, res) => {
    const { serviceType, subServiceType, route, pickupDateTime, dropDateTime, contact,distance} = req.body;
  
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
      distance
      
    });
  
    try {
      await booking.save();
      res.status(201).json({ message: 'Booking created', booking });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create booking', error: error.message });
    }
  });
  

  function formatPhoneNumber(phone) {
    const countryCode = '+91';
    return `${countryCode}${phone}`;
}

// 2. Admin Action: Confirm or Cancel
app.put('/api/bookings/:id/action', 
  body('action').isIn(['Confirmed', 'Canceled']).withMessage('Invalid action'),
  body('driver.name').optional().notEmpty().withMessage('Driver name is required when confirming a booking'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { action, driver } = req.body;

    try {
      // Update booking with action and driver if provided
      const updateData = {
        status: action,
        adminAction: {
          action,
          actionDateTime: new Date(),
        },
      };

      if (action === 'Confirmed') {
        updateData.adminAction.driver = driver;
      }

      const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, { new: true });

      // if (!booking) {
      //   return res.status(404).json({ message: 'Booking not found' });
      // }

      // // Send SMS notification
      // const message = action === 'Confirmed' 
      //   ? `Your booking  has been confirmed. Driver: ${driver.name}, Phone: ${driver.phone}.`
      //   : `Your booking  has been canceled.`;

      // // Assuming the contact information is in the booking document
      // const contact = booking.contact; // Accessing the contact information from the booking
      // if (contact && contact.phone) {
      //     const formattedPhone = formatPhoneNumber(contact.phone); // Format the phone number
      //     // Send SMS using Twilio
      //     await client.messages.create({
      //         body: message,
      //         from: '+16602239964', // Your Twilio phone number
      //         to: formattedPhone, // Using the formatted phone number
      //     });
      // }

      res.status(200).json({ message: `Booking ${action}`, booking });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update booking', error: error.message });
    }
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
  

  app.get('/api/bookings/:id', async (req, res) => {
    try {
      const bookingId = req.params.id; // Get the booking ID from the request parameters
      const booking = await Booking.findById(bookingId); // Find the booking by ID
  
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' }); // Handle case where booking is not found
      }
  
      res.status(200).json({ message: 'Booking retrieved', booking }); // Return the found booking
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve booking', error: error.message }); // Handle errors
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
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))