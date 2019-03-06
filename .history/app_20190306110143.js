var app = require('express')();
var http = require('http').Server(app);
const http1 = require('http');
var io = require('socket.io')(http);
var sql = require('mssql');
var cors = require('cors');

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
  next();
});

// app.get('/', function(req, res) {
//   res.sendfile('index.html');
// });

var server1 = http1.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

io.on('connection', function(socket) {
  executeStoredProc().then(response => {
    if (response && response.length > 0) {
      console.log('response comment connection', response);
      io.emit('comment', response[0]);
    } else {
      console.log('response comment', 'Error');
      io.emit('comment', 'Error');
    }
  });

  socket.on('newcomment', function(data) {
    executeStoredProc().then(response => {
      if (response && response.length > 0) {
        console.log('response comment newcomment', response);
        io.emit('comment', response[0]);
        console.log('new comment published: ', data);
      } else {
        console.log('response comment', 'Error');
        io.emit('comment', 'Error');
      }
    });
  });
});

var port = process.env.PORT || 3000;

server1.listen(port, function() {
  console.log('listening on *:3000');
});

var config = {
  server: 'trenderalert.database.windows.net',
  database: 'trendalertappdb',
  user: 'trenderalertadmin',
  password: 'Newalert190',
  port: 1433,
  options: {
    encrypt: true
  }
};

async function executeStoredProc() {
  var dbConn = new sql.Connection(config);
  await dbConn.connect();

  var request = new sql.Request(dbConn);
  var recordset = await request
    .input('trend_id', sql.Int, 153)
    .execute('usp_getcommentsbytrends');
  dbConn.close();
  return recordset;
}
