//Canvas stuff
var canvas = {};
canvas.element = $("#canvas")[0];
canvas.context = canvas.element.getContext("2d");
canvas.width = $("#canvas").width();
canvas.height = $("#canvas").height();

//Debug stuff
var DEBUG_MODE = false;

//User stuff
var myUserID = 0;
var myUserName;

//Defaults
var GOINSTANT_APP_URL = 'https://goinstant.net/NinjaOtter/NodeKnockout';
var INITIAL_SNAKE_LENGTH = 5;
var INITIAL_SCORE = 0;
var BLOCK_SIZE = 10;

// food
var food = {
  color: 'black'
};

// snakes
var snakes = {};
var snakeKey;

function initializeSnake(userName) {
  snakes[userName] = {
    blocks: [],
    color: '',
    currentScore: 0,
    highScore: 0,
    length: INITIAL_SNAKE_LENGTH,
    direction: ''
  };
  for(var x = 0; x < snakes[myUserName].length; x++) {
    snakes[myUserName].blocks[x] = { x: 0, y: 0 };
  }
}
function initializeGame() {

  goinstant.connect(GOINSTANT_APP_URL, function (err, platform, lobby) {
    if (err) {
      throw err;
    }

    snakeKey = lobby.key('/snakes');
    food.key = lobby.key('/food');

    getUsername();
    initializeSnake(myUserName);
    spawnSnake(myUserName);

    // Setup GoInstant widgets
    var userList = new goinstant.widgets.UserList({
      room: lobby,
      collapsed: false,
      position: 'right'
    });

    var notifications = new goinstant.widgets.Notifications();
    var userColors = new goinstant.widgets.UserColors({ room: lobby });

    // Initialize the UserList widget
    userList.initialize(function(err) { });

    // Get all notifications
    notifications.subscribe(lobby, function(err) { });

    var foodListener = function(val) { 
      food = { x: val.x, y: val.y };
    };

    food.key.on('set', { local: true, listener: foodListener });

    food.key.get(function(err, value, context) {
      if (value) {
        food = {
          x: value.x,
          y: value.y
        };
      } else {
        spawnFood();
      }

      snakeKey.key("/" + myUserName).set(snakes[myUserName], function(err) { 
        if (err) {
          throw err; 
        }
      });

      var snakeListener = function(val, context) { 
        var username = context.key.substr('/snakes/'.length);
        snakes[username] = context.value;
      };

      snakeKey.on('set', { bubble:true, listener: snakeListener });

      snakeKey.get(function(err, value, context) {
        if (err) {
          throw err;
        }
        snakes = value;

        // randomly select a color for the user
        userColors.choose(function(err, color) { 
          snakes[myUserName].color = color;
        });


        // Change the user's name
        lobby.user(function(err, user, userKey) {
          if (err) throw err;

          var displayNameKey = userKey.key('displayName');
          displayNameKey.set(myUserName, function(err) {
            if (err) throw err;

            var publishOpts = {
              room: lobby,
              type: 'success',
              message: myUserName + ' has joined.',
              displayToSelf: true
            };

            // publish a notification of the new user  
            notifications.publish(publishOpts, function(err) {
              if (err) {
                throw err;
              }

              if(typeof gameTimer != "undefined") {
                clearInterval(gameTimer);
              }
              gameTimer = setInterval(gameTick, 60);
            });
          });
        });
      }); 
    });
  });
}

function gameTick() {
  //Draw the canvas all the time to avoid trails.
  drawCanvas();

  //Move snakes & detect collisions
  _.each(_.keys(snakes), function(username) {
    var currentSnake = snakes[username];

    drawSnake(currentSnake);
    incrementSnakePosition(username);

    // only with our snake
    if(username == myUserName) {

      if (checkWallCollision(username)) {
        spawnSnake(username);
      }

      // This will prevent all other players from respawning the food
      if (checkFoodCollision(username)) {

        increaseSnakeLength(username);
        spawnFood();
        currentSnake.currentScore++;
        updateHighScore(username);
      }
    }
  });

  drawFood();
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
  canvas.context.fillStyle = food.color;
  canvas.context.fillRect((food.x*BLOCK_SIZE), (food.y*BLOCK_SIZE), BLOCK_SIZE, BLOCK_SIZE);
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
  if(currentSnake.blocks[0].y == food.y && currentSnake.blocks[0].x == food.x) {
    return true;
  }
  return false;
}

function updateHighScore(userName) {
  var currentSnake = snakes[snakeUsername];
  if(currentSnake.highScore < currentSnake.currentScore) {
    currentSnake.highScore = currentSnake.currentScore;
  }
}

function spawnSnake(snakeUsername) {
  //spawn a new instance of the snake & destroy the old
  var currentSnake = snakes[snakeUsername];

  //Set length to default
  currentSnake.length = INITIAL_SNAKE_LENGTH;

  //Did the user hit a high score?
  updateHighScore(snakeUsername);

  //Reset score
  currentSnake.currentScore = INTIAL_SCORE;

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

  this.snakeKey.key("/" + snakeUsername).set(currentSnake, function(err) {
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

function spawnFood() {
  food = {
    x: Math.round(Math.random()*((canvas.width-200)-BLOCK_SIZE)/BLOCK_SIZE), 
    y: Math.round(Math.random()*(canvas.height-BLOCK_SIZE)/BLOCK_SIZE), 
  };
  food.key.set(food, function(err) {
    if(err) {
      throw err;
    }
  });
}

// If the user is unknown to us, try to get a username
function getUsername() {
  myUserName = sessionStorage.getItem('gi_username');
  if (myUserName) {
    return;
  }

  myUserName = prompt('What is your name?', 'Guest');
  if (!myUserName){
    myUserName = 'Guest';
  }
  sessionStorage.setItem('gi_username', myUserName);
} 

$(document).ready(function () {
  // Init GoInstant
  initializeGame();
});

$(window).on('beforeunload', function(){
  snakeKey.key("/" + myUserName).remove(function(err, value, context) {
    if (err) {
      throw err;
    }
  });
});

// Keyboard Controls
$(document).keydown(function(e){
  var key = e.which;
  var currentSnake = snakes[myUserName];
  if(key == "37" && currentSnake.direction != "right") {
    currentSnake.direction = "left";
  } else if(key == "38" && currentSnake.direction != "down") {
    currentSnake.direction = "up";
  } else if(key == "39" && currentSnake.direction != "left") {
    currentSnake.direction = "right";
  } else if(key == "40" && currentSnake.direction != "up") {
    currentSnake.direction = "down";
  }
  console.log("CurrentDirection:",snakes[myUserName].direction);

  snakeKey.key("/" + myUserName).set(currentSnake, function(err) {
    if(err) {
      throw err;
    }
  });
});


