var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, { origins: '*:*' });
var sql = require('mssql');
var cors = require('cors');
const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const MESSAGE = Symbol.for('message');
const stringify = require('json-stringify-safe');

const jsonFormatter = logEntry => {
  const base = { timestamp: new Date() };
  const json = Object.assign(base, logEntry);
  logEntry[MESSAGE] = JSON.stringify(json);
  return logEntry;
};

// start logger

const env = process.env.NODE_ENV || 'development';
const logDir = 'log';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const filename = path.join(logDir, 'longInfo.log');

const logger = createLogger({
  // change level if in dev environment versus production
  level: env === 'development' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format(jsonFormatter)(),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.Console({
      level: 'info',
      format: format.combine(
        format.colorize(),
        format.json(),
        format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
    new transports.File({ filename })
  ]
});

// end logger

app.get('/', function(req, res) {
  res.sendfile('socketrun.html');
});

app.use(cors());

var chatUsers = [];
var trendDataArr = [];
var globalUsers = [];
io.on('connection', function(socket) {
  // console.log('user connected', socket);
  logger.log({
    level: 'info',
    message: stringify({ socketconnected: socket.id })
  });

  //------- start add user in connection ----------//
  socket.on('userlogin', loginInfo => {
    logger.log({
      level: 'info',
      message: stringify({ loginInfo: loginInfo })
    });
    console.log('loginInfo', loginInfo);

    globalUsers.push({
      UserProfileId: loginInfo.UserProfileId,
      subscriptionId: socket.id
    });

    var dataToSend = {
      UserProfileId: loginInfo.UserProfileId,
      subscriptionId: socket.id
    };
    console.log('user connected', globalUsers);

    logger.log({
      level: 'info',
      message: stringify({ globalUsers: globalUsers })
    });

    executeStoredProc('updateuseronlinestatus', {
      UserProfileId: loginInfo.UserProfileId,
      IsOnline: 1
    });

    socket.broadcast.emit('userconnected', dataToSend);
  });
  //------- end add user in connection -----------//

  // --------- chat start ---------- //
  socket.on('chatinitiate', userinfo => {
    if (userinfo) {
      let insertRequired = true;
      for (let i = 0; i < chatUsers.length; i++) {
        if (chatUsers[i].subscriptionId == socket.id) {
          insertRequired = false;
        }
      }
      if (insertRequired) {
        chatUsers.push({ userinfo: userinfo, subscriptionId: socket.id });
      }

      console.log('chatUsers', chatUsers);

      logger.log({
        level: 'info',
        message: stringify({ chatUsers: chatUsers })
      });
    }
  });

  socket.on('sendmessage', data => {
    console.log('get message data', data);

    logger.log({
      level: 'info',
      message: stringify({ sendmessage: data })
    });

    var usersArr = getTargettedToUser(data.toUserProfileId);
    var usersArrFrom = getTargettedFromUser(
      data.fromUserProfileId,
      data.toUserProfileId
    );

    console.log('userarray', usersArr);
    if (usersArr && usersArr.length > 0) {
      // insert the data into DB, regardless of the reciepient is online or not
      executeStoredProc('chatsave', data).then(
        res => {
          if (res) {
            logger.log({
              level: 'info',
              message: stringify({ chatsaved: res })
            });

            console.log('inserted', res);
            if (res.length > 0 && res[0].length > 0) {
              // after insertion to db send the message to recipient
              for (let k = 0; k < usersArr.length; k++) {
                var user = usersArr[k];
                var toProfileSubscriptionId = user ? user.subscriptionId : null;
                console.log('user_' + k, user);
                console.log('toProfileSubscriptionId', toProfileSubscriptionId);
                if (toProfileSubscriptionId) {
                  if (res[0][0].Status) {
                    socket.broadcast
                      .to(toProfileSubscriptionId)
                      .emit('getmessage', res[1][0]);
                  }
                }
              }

              console.log('send to self', socket.id);
              socket.emit('getmessage', res[1][0]);

              // console.log('usersArrFrom', usersArrFrom);

              //   // after insertion to db send the message to sender itself other then current sending device
              //   for (let k = 0; k < usersArrFrom.length; k++) {
              //     var user = usersArrFrom[k];
              //     var fromProfileSubscriptionId = user
              //       ? user.subscriptionId
              //       : null;
              //     console.log('user_' + k, user);
              //     console.log(
              //       'fromProfileSubscriptionId',
              //       fromProfileSubscriptionId
              //     );
              //     if (fromProfileSubscriptionId) {
              //       if (res[0][0].Status) {
              //         socket.broadcast
              //           .to(fromProfileSubscriptionId)
              //           .emit('getmessage', res[1][0]);
              //       }
              //     }
              //   }
            }
          }
        },
        err => {
          logger.log({
            level: 'error',
            message: stringify({ Error: err })
          });
        }
      );
    } else {
      executeStoredProc('messagesave', data).then(
        res => {
          if (res) {
            logger.log({
              level: 'info',
              message: stringify({ messagesaved: res })
            });

            console.log('send to self', socket.id);
            socket.emit('getmessage', res[1][0]);

            // // modify here send a basic message
            // console.log('usersArrFrom', usersArrFrom);
            // if (res.length > 0 && res[0].length > 0) {
            //   // after insertion to db send the message to recipient
            //   for (let k = 0; k < usersArrFrom.length; k++) {
            //     var user = usersArrFrom[k];
            //     var fromProfileSubscriptionId = user
            //       ? user.subscriptionId
            //       : null;
            //     console.log('user_' + k, user);
            //     console.log(
            //       'fromProfileSubscriptionId',
            //       fromProfileSubscriptionId
            //     );
            //     if (fromProfileSubscriptionId) {
            //       if (res[0][0].Status) {
            //         socket.broadcast
            //           .to(fromProfileSubscriptionId)
            //           .emit('getmessage', res[1][0]);
            //       }
            //     }
            //   }
            // }
          }
        },
        err => {
          logger.log({
            level: 'error',
            message: stringify({ Error: err })
          });
        }
      );
    }
  });

  const getTargettedToUser = UserId => {
    var chatUser = chatUsers.filter(user => {
      return user.userinfo && user.userinfo.fromUserProfileId == UserId;
    });
    return chatUser;
  };

  const getTargettedFromUser = (FromUserId, ToUserId) => {
    var chatUser = chatUsers.filter(user => {
      return user.userinfo && user.userinfo.fromUserProfileId == FromUserId;
    });
    return chatUser;
  };

  // --------- chat end ----------

  // --------- comment start ----------
  socket.on('commentconnect', function(trendInfo) {
    console.log('trendInfo', trendInfo);
    logger.log({
      level: 'info',
      message: stringify({ trendInfo: trendInfo })
    });
    trendDataArr.push({ trendInfo: trendInfo, subscriptionId: socket.id });
    if (trendInfo) {
      var chatroom = 'comment_' + trendInfo.trendId;
      socket.join(chatroom);
      socket.emit('myroom', { chatroom: chatroom, subscriptionId: socket.id });
    }
  });

  socket.on('sendcomment', function(commentInfo) {
    console.log('comment Info', commentInfo);
    logger.log({
      level: 'info',
      message: stringify({ commentInfo: commentInfo })
    });
    if (commentInfo) {
      executeStoredProc('commentreply', commentInfo).then(
        res => {
          console.log('res', res);

          if (res && res.length > 0 && res[0].length > 0) {
            let commentResponseObj = res[0][0];
            commentResponseObj.Replies = [];
            commentResponseObj.CommentID = parseInt(
              commentResponseObj.CommentID
            );

            if (commentInfo.IsReply == 1 || commentResponseObj.ReplyID) {
              commentResponseObj.ReplyID = parseInt(commentResponseObj.ReplyID);
            }

            let commentReponse = {
              commentData: commentResponseObj,
              IsReply: commentInfo.IsReply == 0 ? false : true
            };

            logger.log({
              level: 'info',
              message: stringify({ commentdata: commentReponse })
            });

            socket.broadcast
              .to(commentInfo.chatroom)
              .emit('commentdata', commentReponse);
          }
        },
        err => {
          console.log('error: ', err);
          logger.log({
            level: 'error',
            message: stringify({ Error: err })
          });
        }
      );
    }
  });
  // --------- comment end ----------

  socket.on('disconnect', () => {
    for (let i = 0; i < chatUsers.length; i++) {
      if (chatUsers[i].subscriptionId === socket.id) {
        chatUsers.splice(i, 1);
        console.log('chat users after disconnect', chatUsers);
        logger.log({
          level: 'info',
          message: stringify({ chat_users_disconnect: chatUsers })
        });
      }
    }

    for (let j = 0; j < trendDataArr.length; j++) {
      if (trendDataArr[j].subscriptionId === socket.id) {
        trendDataArr.splice(j, 1);
        console.log('comment trenders after disconnect', trendDataArr);
        logger.log({
          level: 'info',
          message: stringify({ comment_trenders_disconnect: trendDataArr })
        });
      }
    }

    for (let j = 0; j < globalUsers.length; j++) {
      if (globalUsers[j].subscriptionId === socket.id) {
        console.log('user disconnected', globalUsers[j]);
        socket.broadcast.emit('userdisconnected', globalUsers[j]);
        executeStoredProc('updateuseronlinestatus', {
          UserProfileId: globalUsers[j].UserProfileId,
          IsOnline: 0
        });
        globalUsers.splice(j, 1);

        logger.log({
          level: 'info',
          message: stringify({ globalUsers: globalUsers })
        });
      }
    }
  });
});

http.listen(process.env.PORT || 3100, function() {
  console.log('listening on *:3100');
});

// // Live
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

// Local
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
      .input('trend_id', sql.BigInt, params.trendId)
      .execute('usp_getcommentsbytrends');
  } else if (purpose == 'userchat') {
    recordset = await request
      .input('FromUserProfileId', sql.BigInt, params.FromUserProfileId)
      .input('ToUserProfileId', sql.BigInt, params.ToUserProfileId)
      .execute('UserChatList');
  } else if (purpose == 'chatsave') {
    recordset = await request
      .input('FromUserProfileId', sql.BigInt, params.fromUserProfileId)
      .input('ToUserProfileId', sql.BigInt, params.toUserProfileId)
      .input('UserId', sql.VarChar(200), params.userId)
      .input('ChatText', sql.NVarChar(500), params.message)
      .input('ParentMediaId', sql.BigInt, params.ParentMediaId)
      .execute('SaveChat');
  } else if (purpose == 'commentreply') {
    recordset = await request
      .input('Id', sql.BigInt, params.Id)
      .input('UserProfileId', sql.BigInt, params.UserProfileId)
      .input('IsReply', sql.Bit, params.IsReply)
      .execute('GetCommentReply');
  } else if (purpose == 'updateuseronlinestatus') {
    recordset = await request
      .input('UserProfileId', sql.BigInt, params.UserProfileId)
      .input('IsOnline', sql.Bit, params.IsOnline)
      .execute('SetUserOnlineStatus');
  } else if (purpose == 'messagesave') {
    recordset = await request
      .input('FromUserProfileId', sql.BigInt, params.fromUserProfileId)
      .input('ToUserProfileId', sql.BigInt, params.toUserProfileId)
      .input('UserId', sql.VarChar(200), params.userId)
      .input('ChatText', sql.VarChar(500), params.message)
      .input('IsMessage', sql.Bit, 1)
      .input('ParentMediaId', sql.BigInt, params.ParentMediaId)
      .execute('SaveChat');
  } else if (purpose == 'getchat') {
    recordset = await request
      .input('FromUserProfileId', sql.BigInt, params.fromUserProfileId)
      .input('ToUserProfileId', sql.BigInt, params.toUserProfileId)
      .input('UserId', sql.VarChar(200), params.userId)
      .execute('GetChat');
  }

  dbConn.close();
  return recordset;
};
