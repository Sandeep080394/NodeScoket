var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, { origins: '*:*' });
var sql = require('mssql');
var express = require('express');
var cors = require('cors');

app.get('/', function(req, res) {
  res.sendfile('socketrun.html');
});

app.use(cors());
var users = [];
io.on('connection', function(socket) {
  // socket.on('commentconnect', function(trendId) {
  //   executeStoredProc(trendId).then(response => {
  //     if (response && response.length > 0) {
  //       console.log('response comment newcomment', response);
  //       io.emit('comment', response[0]);
  //       console.log('new comment published: ', trendId);
  //     } else {
  //       console.log('response comment', 'Error');
  //       io.emit('comment', 'Error');
  //     }
  //   });
  // });

  socket.on('newcomment', function(comment) {
    io.emit('comment', comment);
  });

  // chat starts
  socket.on('chatinitiate', userinfo => {
    if (userinfo) {
      executeStoredProc('userchat', userinfo).then(res => {
        console.log('chat data', res);
        var chatDataFuncName = 'chatData' + userinfo.FromUserProfileId;
        console.log('chatDataFuncName', chatDataFuncName);
        io.emit(chatDataFuncName, res[0]);
      });
    }
  });
  // chat ends

  socket.on('username', userName => {
    users.push({
      id: socket.id,
      userName: userName
    });

    let len = users.length;
    len--;

    io.emit('userList', users, users[len].id);
  });

  socket.on('getMsg', data => {
    console.log('get msg data', data);
    console.log('to id ', data.toid);
    socket.broadcast.to(users[data.toid].id).emit('sendMsg', {
      msg: data.msg,
      name: data.name
    });
  });

  socket.on('disconnect', () => {
    for (let i = 0; i < users.length; i++) {
      if (users[i].id === socket.id) {
        users.splice(i, 1);
      }
    }
    io.emit('exit', users);
  });
});

http.listen(process.env.PORT || 3000, function() {
  console.log('listening on *:3000');
});

// var config = {
//   server: 'trenderalert.database.windows.net',
//   database: 'trendalertappdb',
//   user: 'trenderalertadmin',
//   password: 'Newalert190',
//   port: 1433,
//   options: {
//     encrypt: true
//   }
// };

var config = {
  server: '172.16.1.2',
  database: 'trendalertappdb',
  user: 'dotnet',
  password: '@sp@2020',
  port: 1433
};

const executeStoredProc = async (purpose, params) => {
  var dbConn = new sql.Connection(config);
  await dbConn.connect();

  var request = new sql.Request(dbConn);
  var recordset;

  if (purpose == 'commentsbytrends') {
    recordset = await request
      .input('trend_id', sql.Int, params.trendId)
      .execute('usp_getcommentsbytrends');
  } else if (purpose == 'userchat') {
    recordset = await request
      .input('FromUserProfileId', sql.Int, params.FromUserProfileId)
      .input('ToUserProfileId', sql.Int, params.ToUserProfileId)
      .execute('UserChatList');
  }

  dbConn.close();
  return recordset;
};