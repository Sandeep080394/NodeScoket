var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, { origins: '*:*' });
var sql = require('mssql');
// var express = require('express');
var cors = require('cors');

app.get('/', function(req, res) {
  res.sendfile('socketrun.html');
});

app.use(cors());

var chatUsers = [];
io.on('connection', function(socket) {
  // --------- chat start ----------

  socket.on('chatinitiate', userinfo => {
    if (userinfo) {
      chatUsers.push({ userinfo: userinfo, subscriptionId: socket.id });
      console.log('chatUsers', chatUsers);
      socket.emit('chatconnection', socket.id);
    }
  });

  socket.on('sendmessage', data => {
    console.log('get message data', data);
    var usersArr = getTargettedToUser(data.toUserProfileId);

    // insert the data into DB, regardless of the reciepient is online or not
    executeStoredProc('chatsave', data).then(res => {
      if (res) {
        console.log('inserted', res);
      }
    });
    for (let k = 0; k < usersArr.length; k++) {
      var user = usersArr[k];
      var toProfileSubscriptionId = user ? user.subscriptionId : null;
      console.log('user_' + k, user);
      console.log('toProfileSubscriptionId', toProfileSubscriptionId);
      if (toProfileSubscriptionId) {
        socket.broadcast
          .to(toProfileSubscriptionId)
          .emit('getmessage', data.message);
      }
    }
  });

  socket.on('disconnect', () => {
    for (let i = 0; i < chatUsers.length; i++) {
      if (chatUsers[i].subscriptionId === socket.id) {
        chatUsers.splice(i, 1);
      }
    }
    console.log('chat users after disconnect', chatUsers);
  });

  const getTargettedToUser = UserId => {
    var chatUser = chatUsers.filter(user => {
      return user.userinfo && user.userinfo.fromUserProfileId == UserId;
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
      executeStoredProc('commentreply', commentInfo).then(
        res => {
          console.log('res', res);
          if (res && res.length > 0) {
            socket.broadcast
              .to(commentInfo.chatroom)
              .emit('commentdata', res[0]);
          }
        },
        err => {
          console.log('error: ', err);
        }
      );
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
    console.log('params', params);
    recordset = await request
      .input('FromUserProfileId', sql.Int, params.fromUserProfileId)
      .input('ToUserProfileId', sql.Int, params.toUserProfileId)
      .input('ChatText', sql.VarChar(500), params.message)
      .execute('SaveChat');
  } else if (purpose == 'commentreply') {
    await request
      .input('Id', sql.Int, params.Id)
      .input('UserProfileId', sql.Int, params.UserProfileId)
      .input('IsReply', sql.Bit, params.IsReply)
      .execute('GetCommentReply');
  }

  dbConn.close();
  return recordset;
};