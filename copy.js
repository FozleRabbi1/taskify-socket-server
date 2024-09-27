const express = require('express');
const { createServer } = require('http');
const { join } = require('path');
const { Server } = require('socket.io');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');

const app = express();
const server = createServer(app);

// Setup Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// MongoDB connection URI and options
const uri = `mongodb://Taskify:48bnzfIC3Idn70FR@realestate-shard-00-00.fobat.mongodb.net:27017,realestate-shard-00-01.fobat.mongodb.net:27017,realestate-shard-00-02.fobat.mongodb.net:27017/?ssl=true&replicaSet=atlas-9ylh6u-shard-0&authSource=admin&retryWrites=true&w=majority&appName=RealEstate`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let chatCollection, usersCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db('test');
    chatCollection = db.collection('messages');
    usersCollection = db.collection('users');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

// Connect to MongoDB
connectDB();

// Setup CORS middleware for all routes
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.static(join(__dirname, 'build')));

// Serve React frontend
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'build', 'index.html'));
});

// API to get all users
app.get('/users', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// API to get chat history between two users
app.get('/chat/:sender/:receiver', async (req, res) => {
  const { sender, receiver } = req.params;
  try {
    const chatHistory = await chatCollection.find({
      $or: [
        { sender: sender, receiver: receiver },
        { sender: receiver, receiver: sender }
      ]
    }).toArray();
    res.status(200).json(chatHistory);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Socket.IO connection for real-time chat
io.on('connection', (socket) => {
  console.log('a user connected');

  // Join a room for private chats based on email
  socket.on('joinRoom', (email) => {
    socket.join(email);
    console.log(`${email} joined their room`);
  });

  // Listen for user-specific chat messages
  socket.on('chatMessage', (data) => {
    const { sender, receiver, message } = data;

    const newMessage = {
      sender,
      receiver,
      message,
      timestamp: new Date(),
    };

    // Insert the message into the database
    chatCollection.insertOne(newMessage, (err) => {
      if (err) {
        console.error('Error saving message:', err);
      } else {
        // Emit the message only to the sender and receiver
        io.to(sender).to(receiver).emit('chatMessage', newMessage);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Start the server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
