//Canvas stuff
var canvas = {};
canvas.element = $("#canvas")[0];
canvas.context = canvas.element.getContext("2d");
canvas.width = $("#canvas").width();
canvas.height = $("#canvas").height();

//Debug stuff
var DEBUG_MODE = false;

//Sharing stuff
var GO_SNAKE_ID = 'go_snake_room';
var QUERY_REGEX = new RegExp('\\?(.*)\\b' + GO_SNAKE_ID + '=([^&#\/]*)(.*)');
var roomName;
var query;

//User stuff
var myUserId;
var myUserName;

//Defaults
var GO_SNAKE_APP_URL = 'https://goinstant.net/NinjaOtter/NodeKnockout';
var INITIAL_SNAKE_LENGTH = 5;
var INITIAL_SCORE = 0;
var BLOCK_SIZE = 10;

// food
var food = {};

// snakes
var snakes = {};
var snakeKey;

var lobby;
var el = {};
var highScore;

function initializeSnake(cb) {
  snakes[myUserId] = {
    blocks: [],
    currentScore: INITIAL_SCORE,
    length: INITIAL_SNAKE_LENGTH,
    direction: ''
  };
  el.userScore.text(INITIAL_SCORE);

  // randomly select a color for the user
  var userColors = new goinstant.widgets.UserColors({ room: lobby });
  userColors.choose(function(err, color) {
    if (err) {
      throw err;
    }

    $('.user-label').css('background-color',color);

    // set that as their snake color
    snakes[myUserId].color = color;

    for(var x = 0; x < snakes[myUserId].length; x++) {
      snakes[myUserId].blocks[x] = { x: 0, y: 0 };
    }
    var snakeListener = function(val, context) {
      var username = context.key.substr('/snakes/'.length);
      snakes[username] = context.value;
    };
    snakeKey.on('set', { bubble:true, listener: snakeListener });
    snakeKey.key("/" + myUserId).set(snakes[myUserId], function(err) {
      if (err) {
        throw err;
      }
      snakeKey.get(function(err, value, context) {
        if (err) {
          throw err;
        }
        snakes = value;
        spawnSnake(myUserId);
        return cb();
      });
    });
  });
}
function initializeHighScore(cb) {
  var highScoreKey = lobby.key('/highScore');
  highScoreKey.on('set', function(val, context) {
    highScore = val;
    el.highScore.text(highScore);
  }.bind(this));
  highScoreKey.get(function(err, val) {
    if (err) {
      throw err;
    }
    highScore = val;
    return cb();
  });
}

function initializeGame() {

  if (setRoomName()) {
    goinstant.connect(GO_SNAKE_APP_URL, { room: roomName }, function(err, platform, room) {
      if (err) {
        throw err;
      }
      lobby = room;

      snakeKey = lobby.key('/snakes');

      async.series([
        initializeUser,
        initializeFood,
        initializeHighScore,
        initializeSnake,
        initializeNotifications,
        initializeGameLoop,
        initializeSharing
      ], function(err) {
        if (err) {
          throw err;
        }
      });
    });
  }
}

function initializeSharing(cb) {
  // We are interested in knowing if there is a new query on the URL when the
  // slide show is loaded. This detects the use of the query parameter in the
  // default slide deck to change the transitions and themes.
  var parser = document.createElement('a');
  parser.href = window.location.toString();

  // Create the sharing URL by adding the roomName as a query parameter to
  // the current window.location.
  if (parser.search) {
    parser.search += '&' + GO_SNAKE_ID + '=' + roomName;
  } else {
    parser.search = '?' + GO_SNAKE_ID + '=' + roomName;
  }

  // Create Share Button
  addShareButton(parser.href);
}

function addShareButton(text) {
  var shareBtn = document.createElement('div');
  var cssBtn = 'display: block; position: fixed; bottom: 1em; left: 0; ' +
    'z-index: 9999; height: 17px; padding: 9px; font-size: 15px; ' +
    'font-family: sans-serif; font-weight: bold; background: white; ' +
    'border-radius: 0 3px 3px 0; border: 1px solid #ccc; ' +
    'text-decoration: none; color: #15A815;';
  var cssURL = 'font-weight: regular;';

  shareBtn.innerHTML = 'Share';
  shareBtn.style.cssText = cssBtn;

  var main = document.getElementsByClassName('instructions')[0];
  main.parentNode.insertBefore(shareBtn, main);

  shareBtn.onmouseover = function() {
    if (this.poppedOut) {
      return;
    }
    this.poppedOut = true;

    this.innerHTML +=
      '<input id="gi-share-text" type="text" value="' + text +
      '" style="margin: -5px 0 0 15px; padding: 5px; width: 180px;"/>';

    this.style.width = '250px';
    document.getElementById('gi-share-text').select();
  };

  shareBtn.onmouseout = function(evt) {
    if (evt.relatedTarget && evt.relatedTarget.id === 'gi-share-text') {
      return;
    }
    this.poppedOut = false;

    this.innerHTML = 'Share';
    this.style.width = 'auto';
  };
}

function setRoomName() {
  // if we have the go-SNAKE room in sessionStorage then just connect to
  // the room and continue with the initialization.
  roomName = sessionStorage.getItem(GO_SNAKE_ID);
  if (roomName) {
    return true;
  }

  // if we do not have the name in storage then check to see if the window
  // location contains a query string containing the id of the room.

  // creating an anchor tag and assigning the href to the window location
  // will automatically parse out the URL components ... sweet.
  var parser = document.createElement('a');
  parser.href = window.location.toString();

  var hasRoom = QUERY_REGEX.exec(parser.search);
  var roomId = hasRoom && hasRoom[2];
  if (roomId) {
    roomName = roomId.toString();
    // add the cookie to the document.
    sessionStorage.setItem(GO_SNAKE_ID, roomName);

    // regenerate the URI without the go-SNAKE query parameter and reload
    // the page with the new URI.
    var beforeRoom = hasRoom[1];
    if (beforeRoom[beforeRoom.length - 1] === '&') {
      beforeRoom = beforeRoom.slice(0, beforeRoom.lengh - 1);
    }
    var searchStr = beforeRoom + hasRoom[3];
    if (searchStr.length > 0) {
      searchStr = '?' + searchStr;
    }

    parser.search = searchStr;

    // set the new location and discontinue the initialization.
    window.location = parser.href;
    return false;
  }

  // there is no room to join for this SNAKE so simply create a new
  // room and set the cookie in case of future refreshes.
  var id = Math.floor(Math.random() * Math.pow(2, 32));
  roomName = id.toString();
  sessionStorage.setItem(GO_SNAKE_ID, roomName);

  return true;
}

// If the user is unknown to us, try to get a username
function initializeUser(cb) {
  myUserName = sessionStorage.getItem('gi_username');
  if (!myUserName) {
    myUserName = prompt('What is your name?', 'Guest');
    if (!myUserName){
      myUserName = 'Guest';
    }
    sessionStorage.setItem('gi_username', myUserName);
  }
  var userList = new goinstant.widgets.UserList({
    room: lobby,
    collapsed: false,
    position: 'right'
  });
  lobby.self().get(function(err, val, userKey) {
    if (err) {
      throw err;
    }
    myUserId = val.id;

    var displayNameKey = lobby.self().key('displayName');
    displayNameKey.set(myUserName, function(err) {
      if (err) {
        throw err;
      }
      userList.initialize(function(err) {
        return cb();
      });
    });
  });
} 

function initializeNotifications(cb) {
  var notifications = new goinstant.widgets.Notifications();

  // Get all notifications of users joining
  notifications.subscribe(lobby, function(err) {
    if (err) {
      throw err;
    }

    // publish a notification of the new user
    var msg = myUserName + ' has joined.';
    notifications.publish({
      room: lobby,
      type: 'success',
      message: msg,
      displayToSelf: true
    }, function(err) {
      if (err) {
        throw err;
      }
      return cb();
    });
  });
}

function initializeGameLoop(cb) {
  if(typeof gameTimer != "undefined") {
    clearInterval(gameTimer);
  }
  gameTimer = setInterval(gameTick, 60);
  return cb();
}

function initializeFood(cb) {
  food = {
    key: lobby.key('/food'),
    color: 'black',
    position: {
      x: 0,
      y: 0
    }
  };
  var foodListener = function(val) {
    food.position = val;
  };

  food.key.on('set', { local: true, listener: foodListener });
  food.key.get(function(err, value, context) {
    if (value) {
      food.position = value;
      return cb();
    }
    spawnFood(cb);
  });
}

function gameTick() {
  //Draw the canvas all the time to avoid trails.
  drawCanvas();
  drawFood();

  //Move snakes & detect collisions
  _.each(_.keys(snakes), function(username) {
    var currentSnake = snakes[username];

    drawSnake(currentSnake);
    incrementSnakePosition(username);

    // only with our snake
    if(username == myUserId) {

      if (checkWallCollision(username)) {
        spawnSnake(username);
      }

      // This will prevent all other players from respawning the food
      if (checkFoodCollision(username)) {

        increaseSnakeLength(username);
        spawnFood(null);
        currentSnake.currentScore++;
        el.userScore.text(currentSnake.currentScore);
        updateHighScore(username);
      }
    }
  });
}

function incrementSnakePosition(username) {
  var currentSnake = snakes[username];
  switch(currentSnake.direction) {
    case 'up':
      currentSnake.blocks[0].y--;
      break;
    case 'down':
      currentSnake.blocks[0].y++;
      break;
    case 'left':
      currentSnake.blocks[0].x--;
      break;
    case 'right':
      currentSnake.blocks[0].x++;
      break;
  }
}

function increaseSnakeLength(username) {
  var currentSnake = snakes[username];
  currentSnake.length++;

  currentSnake.blocks[currentSnake.length-1] = {
    x: currentSnake.blocks[currentSnake.length-2].x,
    y: currentSnake.blocks[currentSnake.length-2].y
  };

  switch(currentSnake.direction) {
    case 'up':
      currentSnake.blocks[currentSnake.length-1].y--;
      break;
    case 'down':
      currentSnake.blocks[currentSnake.length-1].y++;
      break;
    case 'left':
      currentSnake.blocks[currentSnake.length-1].x--;
      break;
    case 'right':
      currentSnake.blocks[currentSnake.length-1].x++;
      break;
    default:
      throw new Error("invalid snake direction");
  }
}

function drawFood() {
  canvas.context.beginPath();
  canvas.context.fillStyle = food.color;
  canvas.context.fillRect((food.position.x*BLOCK_SIZE), (food.position.y*BLOCK_SIZE), BLOCK_SIZE, BLOCK_SIZE);
  canvas.context.stroke();
}

function drawSnake(currentSnake) {
  canvas.context.fillStyle = currentSnake.color;
  for(var x = currentSnake.length-1; x >= 0; x--) {
    canvas.context.fillRect((currentSnake.blocks[x].x*BLOCK_SIZE), (currentSnake.blocks[x].y*BLOCK_SIZE), BLOCK_SIZE, BLOCK_SIZE);

    //Inherit past position, only on our snake
    if(x > 0) {
      currentSnake.blocks[x].x = currentSnake.blocks[x-1].x;
      currentSnake.blocks[x].y = currentSnake.blocks[x-1].y;
    }
  }
}

// this will get rid of other snakes from lost connections, etc.
function checkWallCollision(username) {
  var currentSnake = snakes[username];
  if (currentSnake.blocks[0].y < -1 ||
       currentSnake.blocks[0].y > (canvas.height/BLOCK_SIZE) ||
       currentSnake.blocks[0].x < -1 ||
       currentSnake.blocks[0].x > (canvas.width/BLOCK_SIZE)) {
    return true;
  }
  return false;
}

function checkFoodCollision(username) {
  var currentSnake = snakes[username];
  if(currentSnake.blocks[0].y == food.position.y && currentSnake.blocks[0].x == food.position.x) {
    return true;
  }
  return false;
}

function updateHighScore(userName) {
  var currentSnake = snakes[userName];
  if(highScore < currentSnake.currentScore) {
    highScore = currentSnake.currentScore;
    lobby.key('/highScore').set(highScore, function(err) {
      if(err) {
        throw err;
      }
    });
  }
  el.highScore.text(highScore);
}

function spawnSnake(snakeUsername) {
  //spawn a new instance of the snake & destroy the old
  var currentSnake = snakes[snakeUsername];

  //Set length to default
  currentSnake.length = INITIAL_SNAKE_LENGTH;

  //Did the user hit a high score?
  updateHighScore(snakeUsername);

  //Reset score
  currentSnake.currentScore = INITIAL_SCORE;
  el.userScore.text(currentSnake.currentScore);

  //Find new spawn location
  var newPos = {
    x: Math.round(Math.random()*(canvas.width-BLOCK_SIZE)/BLOCK_SIZE),
    y: Math.round(Math.random()*(canvas.height-BLOCK_SIZE)/BLOCK_SIZE)
  };

  //Set new direction
  switch(Math.round(Math.random()*3)) {
    case 0:
      currentSnake.direction = 'up';
      break;
    case 1:
      currentSnake.direction = 'down';
      break;
    case 2:
      currentSnake.direction = 'left';
      break;
    case 3:
      currentSnake.direction = 'right';
      break;
  }

  //Setup new snake blocks
  currentSnake.blocks[0].x = newPos.x;
  currentSnake.blocks[0].y = newPos.y;

  for(var x = 1; x < currentSnake.length; x++) {
    currentSnake.blocks[x].x = currentSnake.blocks[x-1].x;
    currentSnake.blocks[x].y = currentSnake.blocks[x-1].y;

    switch(currentSnake.direction){
      case 'up':
        currentSnake.blocks[x].y--;
        break;
      case 'down':
        currentSnake.blocks[x].y++;
        break;
      case 'right':
        currentSnake.blocks[x].x--;
        break;
      case 'left':
        currentSnake.blocks[x].x++;
        break;
      default:
        throw new Error("invalid snake direction");
    }
  }

  this.snakeKey.key("/" + myUserId).set(currentSnake, function(err) {
    if(err) throw err;
  });
}

function drawDebugCanvas() {
  for(var x=0; x<(canvas.width/BLOCK_SIZE); x++) {
    for(var y=0; y<(canvas.height/BLOCK_SIZE); y++) {
      canvas.context.fillStyle = "white";
      canvas.context.fillRect((x*BLOCK_SIZE), (y*BLOCK_SIZE), BLOCK_SIZE, BLOCK_SIZE);
      canvas.context.strokeStyle = "black";
      canvas.context.strokeRect((x*BLOCK_SIZE), (y*BLOCK_SIZE), BLOCK_SIZE, BLOCK_SIZE);
    }
  }
}

function drawCanvas() {
  if (DEBUG_MODE) {
    drawDebugCanvas();
  } else {
    canvas.context.fillStyle = "white";
    canvas.context.fillRect(0, 0, canvas.width, canvas.height);
    canvas.context.strokeStyle = "black";
    canvas.context.strokeRect(0, 0, canvas.width, canvas.height);			
  }
}

function spawnFood(cb) {
  food.position.x = Math.round(Math.random()*((canvas.width-200)-BLOCK_SIZE)/BLOCK_SIZE);
  food.position.y = Math.round(Math.random()*(canvas.height-BLOCK_SIZE)/BLOCK_SIZE);
  food.key.set(food.position, function(err) {
    if(err) {
      throw err;
    }
    if (cb)
    return cb();
  });
}

$(document).ready(function () {
  el.userScore = $(".user-score.score");
  el.highScore = $(".high-score.right .score");
  // Init GoInstant

  initializeGame();
});

$(window).on('beforeunload', function(){
  snakeKey.key("/" + myUserId).remove(function(err, value, context) {
    if (err) {
      throw err;
    }
  });
});

var arrowKeys=new Array(37,38,39,40);

// Keyboard Controls
$(document).keydown(function(e){
  var key = e.which;
  var currentSnake = snakes[myUserId];
  if(key == "37" && currentSnake.direction != "right") {
    currentSnake.direction = "left";
  } else if(key == "38" && currentSnake.direction != "down") {
    currentSnake.direction = "up";
  } else if(key == "39" && currentSnake.direction != "left") {
    currentSnake.direction = "right";
  } else if(key == "40" && currentSnake.direction != "up") {
    currentSnake.direction = "down";
  }

  if($.inArray(key,arrowKeys) > -1) {
    e.preventDefault();
  }

  if (myUserId && currentSnake) {
    snakeKey.key("/" + myUserId).set(currentSnake, function(err) {
      if(err) {
        throw err;
      }
    });
  }
});


