var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sql = require('mssql');

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

// // handling the connected clients
// var clients = 0;
// io.on('connection', function(socket) {
//    clients++;

//    // code for emitting the data to all clients
//    io.sockets.emit('broadcast',{ description: clients + ' clients connected!'});

//    // Code when disconnect event fires
//    socket.on('disconnect', function () {
//       clients--;
//       io.sockets.emit('broadcast',{ description: clients + ' clients connected!'});
//    });
// });

// var clients = 0;
// io.on('connection', function(socket) {
//    clients++;
//    //new user will get this message bcoz he subsribes now
//    socket.emit('newclientconnect',{ description: 'Hey, welcome!'});

//    // others will get this message as it is a broadcast
//    socket.broadcast.emit('newclientconnect',{ description: clients + ' clients connected!'})

//    socket.on('disconnect', function () {
//       clients--;
//       socket.broadcast.emit('newclientconnect',{ description: clients + ' clients connected!'})
//    });

// });

// var nsp = io.of('/my-namespace');
// io.on('connection', function(socket) {
//   executeStoredProc().then(response => {
//     console.log('response comment', response);
//     nsp.emit('hi', response);
//   });
// });

io.on('connection', function(socket) {

  executeStoredProc().then(response => {
    if (response && response.length > 0) {
      console.log('response comment', response[0]);
      io.emit('comment', response[0]);
    } else {
      console.log('response comment', 'Error');
      io.emit('comment', response);
    }
  });

  io.sockets.emit('broadcast',{ description: ' clients connected!'});

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

var config = {
  server: '172.16.1.2',
  database: 'trendalertappdb',
  user: 'dotnet',
  password: '@sp@2020',
  port: 1433
};

async function executeStoredProc() {
  var dbConn = new sql.Connection(config);
  await dbConn.connect();

  var request = new sql.Request(dbConn);
  var recordset = await request
    .input('trend_id', sql.Int, 30096)
    .execute('usp_getcommentsbytrends');
  console.log('comment response server', recordset);
  dbConn.close();
  return recordset;
}
