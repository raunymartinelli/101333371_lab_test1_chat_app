const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');

const port = process.env.PORT || 3000; // Use the value of PORT environment variable or default to 3000

const DB_CONNECTION = "mongodb+srv://raunymartinelli:bBEcU8gtT4bFxlnK@cluster0.ws44tvx.mongodb.net/w2024_comp3133?retryWrites=true&w=majority";

// MongoDB connection
mongoose.connect(DB_CONNECTION, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Success Mongodb connection');
}).catch(err => {
    console.error('Error Mongodb connection:', err.message);
});

// Middleware
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));



// Serve the static HTML files

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/signup.html');
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.get('/group-chat', (req, res) => {
    res.sendFile(__dirname + '/group_chat.html');
});

app.get('/room-selection', (req, res) => {
    res.sendFile(path.join(__dirname, 'room-selection.html'));
});

// MongoDB Models
const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    firstname: String,
    lastname: String,
    email: {type: String, unique: true},
    password: String,
    createdOn: { type: Date, default: Date.now }
}));

const GroupMessage = mongoose.model('GroupMessage', new mongoose.Schema({
    from_user: String,
    room: String,
    message: String,
    date_sent: { type: Date, default: Date.now }
}));

const PrivateMessage = mongoose.model('PrivateMessage', new mongoose.Schema({
    from_user: String,
    to_user: String,
    message: String,
    date_sent: { type: Date, default: Date.now }
}));

// Routes for signup and login
app.post('/signup', async (req, res) => {
    const { firstName, lastName, age, email, password } = req.body;
    const username = (firstName + lastName).replace(/\s/g, '');
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, firstname: firstName, lastname: lastName, password: hashedPassword });
    await user.save();
    res.json({ username, message: 'Registration successful!' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user._id;
        res.redirect('/group-chat');
    } else {
        res.status(401).send('Invalid username or password');
    }
});

// Socket.io communication
io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        socket.join(data.room); // Join the specified room
        console.log(`User with username: ${data.username} and ID: ${socket.id} joined room: ${data.room}`);
        socket.to(data.room).emit('user_joined', `${data.username} has joined the room.`);
    });

    // When a user leaves a room
    socket.on('leave_room', (data) => {
        socket.leave(data.room);
        console.log(`User with username: ${data.username} has left the room: ${data.room}`);
        socket.to(data.room).emit('user_left', `${data.username} has left the room.`);
    });

    // When a user sends a message
    socket.on('send_message', async (data) => {
        const message = new GroupMessage({
            from_user: data.from_user, // Use the username from the client
            room: data.room,
            message: data.message,
            date_sent: new Date()
        });
        await message.save();
        io.in(data.room).emit('receive_message', { message: data.message, from_user: data.from_user }); // Emit to all users in the room
    });

    // When a user is typing
    socket.on('typing', (data) => {
        socket.to(data.room).emit('user_typing', `${data.username} is typing...`);
    });

    // Other socket event handlers...
});

http.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
