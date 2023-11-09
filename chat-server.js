// Require the packages we will use:
const http = require("http"),
    fs = require("fs");

const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer(function (req, res) {
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile(file, function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.

        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});

// map of user id to username and room [username, room]
let users = {}

// map of rooms to owners [owner, password]
let owners = { 'Main': [null, ''] }

// map of users to rooms they are banned from
let banned = new Map()


// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    // sending a message
    socket.on('send_message', function (message) {
        io.sockets.emit('message', { message: message, user_info: users[socket.id] })
    });
    // sending a private message
    socket.on('send_priv_message', function (data) {
        io.sockets.emit('priv_message', { message: data['message'], sender: data['sender'], receiver: data['receiver'], user_info: users[socket.id] })
    });
    // add username to users map
    socket.on('send_username', function (username) {
        users[socket.id] = [username, 'Main']
        io.sockets.emit('user_connect', username)
    });
    // remove username from users map
    socket.on('disconnect', function () {
        io.sockets.emit('user_disconnect', users[socket.id])
        delete users[socket.id]
    });
    // change user's room and add room to owners map
    socket.on('send_room_info', function (room_info) {
        io.sockets.emit('new_room', { room_info: room_info, user_info: users[socket.id], owner: users[socket.id][0] })
        users[socket.id][1] = room_info['room']
        owners[room_info['room']] = [socket.id, room_info['password']]
    });
    // sending room names
    socket.on('get_rooms', function () {
        io.sockets.emit('rooms', owners)
    });
    // change user's room
    socket.on('room_chosen', function (room_name) {
        let safe = true
        // check if user is banned from room
        if (users[socket.id][0] in banned) {
            for (let i in banned[users[socket.id][0]]) {
                if (room_name == banned[users[socket.id][0]][i]) {
                    safe = false
                }
            }
        }
        if (safe == true) {
            room_info = { room: room_name, password: owners[room_name][1] }
            io.sockets.emit('new_room', { room_info: room_info, user_info: users[socket.id] })
            users[socket.id][1] = room_name
        }

    });

    // change user's room back if incorrect password
    socket.on('inc_password', function (room_name) {
        users[socket.id][1] = room_name
    });

    // sending list of users in specific room
    socket.on('get_users', function (data) {
        let users_in_room = []
        for (let user in users) {
            if (users[user][1] == data['room']) {
                users_in_room.push(users[user][0])
            }
        }
        if (data['action'] == 'private') {
            io.sockets.emit('users', users_in_room)
        } else {
            io.sockets.emit('users_remove', users_in_room)
        }

    });

    // send user back to main room
    socket.on('temp_ban', function (username) {
        room_info = { room: 'Main', password: '' }
        user_info = [username, 'Main']
        io.sockets.emit('temp_ban_alert', username)
        io.sockets.emit('new_room', { room_info: room_info, user_info: user_info })

    });

    // send user back to main room
    socket.on('perm_ban', function (data) {
        room_info = { room: 'Main', password: '' }
        user_info = [data['username'], 'Main']
        if (banned[data['username']] != null) {
            banned[data['username']].push(data['room'])
        } else {
            banned[data['username']] = new Array(data['room'])
        }
        io.sockets.emit('perm_ban_alert', data['username'])
        io.sockets.emit('new_room', { room_info: room_info, user_info: user_info })

    });

    // change user room
    socket.on('change_room', function (room) {
        users[socket.id][1] = room
    });


});



