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

var nsp = io.of('/my-namespace');
nsp.on('connection', function(socket) {
  console.log('someone connected');

  nsp.emit('hi', 'Hello everyone!');
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

function executeStoredProc() {
  var dbConn = new sql.Connection(config);
  dbConn
    .connect()
    .then(function() {
      var request = new sql.Request(dbConn);
      request
        .input('trend_id', sql.Int, 30096)
        .execute('usp_getcommentsbytrends')
        .then(function(recordSet) {
          console.log(recordSet);
          dbConn.close();
        })
        .catch(function(err) {
          console.log(err);
          dbConn.close();
        });
    })
    .catch(function(err) {
      console.log(err);
    });
}

executeStoredProc();
