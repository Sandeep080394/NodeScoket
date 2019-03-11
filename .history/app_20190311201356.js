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

io.on('connection', function(socket) {
  // --------- chat start ----------

  var chatUsers = [];
  socket.on('chatinitiate', userinfo => {
    if (userinfo) {
      chatUsers.push({ userinfo: userinfo, subscriptionId: socket.id });
      socket.emit('chatconnection', socket.id);
    }
  });

  socket.on('sendmessage', data => {
    console.log('chat users arr', chatUsers);
    console.log('get message data', data);

    var usersArr = getToUserSubscriptionId(data.ToUserProfileId);

    for (let k = 0; k < usersArr.length; k++) {
      var user = usersArr[k];
      var toProfileSubscriptionId = user ? user.subscriptionId : null;
      if (ToUserProfileId) {
        // insert the data into DB
        // regardless of the reciepient is online or not
        executeStoredProc('chatsave', data).then(res => {
          if (res) {
            socket.broadcast
              .to(toProfileSubscriptionId)
              .emit('getmessage', data.message);
          }
        });
      }
    }
  });

  socket.on('disconnect', () => {
    for (let i = 0; i < chatUsers.length; i++) {
      if (chatUsers[i].id === socket.id) {
        chatUsers.splice(i, 1);
      }
    }
  });

  const getToUserSubscriptionId = UserId => {
    var chatUser = chatUsers.filter(user => {
      return user.userinfo.ToUserProfileId == UserId;
    });
    return chatUser;
  };

  // --------- chat end ----------

  // --------- comment start ----------
  // var trendDataArr = [];
  socket.on('commentconnect', function(trendInfo) {
    console.log('trend Info', trendInfo);
    if (trendInfo) {
      var chatroom = 'comment_' + trendInfo.trendId;
      console.log('socket.rooms', socket.rooms);
      console.log('joined', chatroom);
      socket.join(chatroom);

      //  trendDataArr.push({ trendInfo: trendInfo, socket: socket });
      socket.emit('myroom', { chatroom: chatroom, subscriptionId: socket.id });
    }
  });

  socket.on('sendcomment', function(commentInfo) {
    console.log('comment Info', commentInfo);
    if (commentInfo) {
      // io.sockets
      //   .in(commentInfo.chatroom)
      //   .emit('commentdata', commentInfo.comment);

      socket.broadcast
        .to(commentInfo.chatroom)
        .emit('commentdata', commentInfo.comment);
    }
  });
  // --------- comment end ----------
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
  } else if (purpose == 'chatsave') {
    recordset = await request
      .input('FromUserProfileId', sql.Int, params.FromUserProfileId)
      .input('ToUserProfileId', sql.Int, params.ToUserProfileId)
      .input('ChatText', sql.Int, params.ToUserProfileId)
      .execute('SaveChat');
  }

  dbConn.close();
  return recordset;
};
