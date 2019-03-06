var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res) {
  res.sendfile('index.html');
});

// //Whenever someone connects this gets executed
// io.on('connection', function(socket) {
//   console.log('A user connected');

//   //Send a message when
//   setTimeout(function() {
//     //Sending an object when emmiting an event
//     socket.emit('testerEvent', {
//       description: 'A custom event named testerEvent!'
//     });
//   }, 4000);

//   // handling event raised from the client
//   socket.on('clientEvent', function(data) {
//     console.log(data);
//   });

//   //Whenever someone disconnects this piece of code executed
//   socket.on('disconnect', function() {
//     console.log('A user disconnected');
//   });
// });

// handling the connected clients
var clients = 0;
io.on('connection', function(socket) {
   clients++;

   // code for emitting the data to all clients
   io.sockets.emit('broadcast',{ description: clients + ' clients connected!'});

   // Code when disconnect event fires
   socket.on('disconnect', function () {
      clients--;
      io.sockets.emit('broadcast',{ description: clients + ' clients connected!'});
   });

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});
