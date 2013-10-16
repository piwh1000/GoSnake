//Canvas stuff
var canvas = $("#canvas")[0];
var ctx = canvas.getContext("2d");
var w = $("#canvas").width();
var h = $("#canvas").height();

//Debug stuff
var debug = false;

//User stuff
var myUserID = 0;
var myUserName = 'user0';

//Defaults
var url = 'https://goinstant.net/NinjaOtter/NodeKnockout';
var snakeLength = 5;
var score = 0;
var blockSize = 10;

// food
var food;
var foodKey;
var foodColor = 'black';

// snakes on a plane
var snake = {};
var snakeKey;

function goinstant_init() {
  goinstant.connect(url, function (err, platform, lobby) {
    if (err) throw err;

    // Listen for snakes
    snakeKey = lobby.key('/snake');

    // If the user is unknown to us, try to get a username
    get_username();

    //Create this user's snake
    snake[myUserName] = {
      blocks: {},
      color: '',
      currentScore: 0,
      highScore: 0,
      length: snakeLength,
      direction: ''
    };

    for(var x = 0; x < snake[myUserName].length; x++) {
      snake[myUserName].blocks[x] = { x: 0, y: 0 };
    }

    respawn_snake(myUserName);

    // Setup GoInstant Widgets
    var UserList = goinstant.widgets.UserList;
    var Notifications = goinstant.widgets.Notifications;
    var UserColors = goinstant.widgets.UserColors;

    // Create a new instances
    var userList = new UserList({
      room: lobby,
      collapsed: false,
      position: 'right'
    });

    var notifications = new Notifications();
    var userColors = new UserColors({ room: lobby });

    // Initialize the UserList widget
    userList.initialize(function(err) { });

    // Get all notifications
    notifications.subscribe(lobby, function(err) { });

    // Create notification
    var publishOpts = {
      room: lobby,
      type: 'success',
      message: myUserName + ' has joined.',
      displayToSelf: true
    };

    // Listen for food
    foodKey = lobby.key('/food');

    var foodListener = function(val) { 
      food = { x: val.x, y: val.y };
    };

    foodKey.on('set', { local: true, listener: foodListener });

    foodKey.get(function(err, value, context) {
      if(!value) {
        create_food();
      } else {
        food = { x: value.x, y: value.y };
      }

      snakeKey.key("/" + myUserName).set(snake[myUserName], function(err) { 
        if(err) throw err; 
      });

      var snakeListener = function(val, context) { 
        var username = context.key.substr('/snake/'.length);
        snake[username] = context.value;
      };

      snakeKey.on('set', { bubble:true, listener: snakeListener });

      snakeKey.get(function(err, value, context) {
        snake = value;
        console.log("Set snake to:", snake);

        // Change the user's name
        lobby.user(function(err, user, userKey) {
          if (err) throw err;

          var displayNameKey = userKey.key('displayName');
          displayNameKey.set(myUserName, function(err) {
            if (err) throw err;

            // randomly select a color for the user
            userColors.choose(function(err, color) { 
              if (!snake[myUserName]) {
                console.log("WTF snake[",myUserName,"] doesn't exist?", snake);
              }
              snake[myUserName].color = color;
            });

            // publish a notification of the new user  
            notifications.publish(publishOpts);
          });
        });
      }); 

      if(typeof game_loop != "undefined") clearInterval(game_loop);
      game_loop = setInterval(game, 60);
    });

  });
}

function game() {
  //Draw the canvas all the time to avoid trails.
  draw_canvas();


  //Move snakes & detect collisions
  _.each(_.keys(snake), function(i) {
    ctx.fillStyle = snake[i].color;
    for(var x = snake[i].length-1; x >= 0; x--) {
      ctx.fillRect((snake[i].blocks[x].x*blockSize), (snake[i].blocks[x].y*blockSize), blockSize, blockSize);

      //Inherit past position, only on our snake
      if(x > 0) {
        snake[i].blocks[x].x = snake[i].blocks[x-1].x;
        snake[i].blocks[x].y = snake[i].blocks[x-1].y;
      }

      //Collision with other snakes
      _.each(_.keys(snake), function(u) {
        for (var x2 = snake[u].length-1; x2 >= 0; x2--) {
          if ((snake[i].blocks[x].x == snake[u].blocks[x2].x) && (snake[i].blocks[x].y == snake[u].blocks[x2].y) && (u != i)) {
            //collision detected
            console.log("respawning");
            respawn_snake(u);
            respawn_snake(i);
          }
        }
      });
    }

    //Move the snake, on our snake
    switch(snake[i].direction)
    {
      case 'up':
        snake[i].blocks[0].y--;
        break;
      case 'down':
        snake[i].blocks[0].y++;
        break;
      case 'left':
        snake[i].blocks[0].x--;
        break;
      case 'right':
        snake[i].blocks[0].x++;
        break;
    }

    //Collision with walls
    if(snake[i].blocks[0].y < -1 || snake[i].blocks[0].y > (h/blockSize) || snake[i].blocks[0].x < -1 || snake[i].blocks[0].x > (w/blockSize))
      respawn_snake(i);

    //Collision with food
    if (!food.y) {
      console.log("BREAKING:", food);
    }
    if(snake[i].blocks[0].y == food.y && snake[i].blocks[0].x == food.x) {
      //Update score
      snake[i].currentScore++;
      if(snake[i].currentScore > snake[i].highScore)
        snake[i].highScore = snake[i].currentScore;

      //Increase Snake length
      snake[i].length++;
      snake[i].blocks[snake[i].length-1] = {
        x: snake[i].blocks[snake[i].length-2].x,
        y: snake[i].blocks[snake[i].length-2].y
      };

      switch(snake[i].direction)
      {
        case 'up':
          snake[i].blocks[snake[i].length-1].y--;
          break;
        case 'down':
          snake[i].blocks[snake[i].length-1].y++;
          break;
        case 'left':
          snake[i].blocks[snake[i].length-1].x--;
          break;
        case 'right':
          snake[i].blocks[snake[i].length-1].x++;
          break;
      }
    }
    create_food();

    //Draw food
    ctx.fillStyle = foodColor;
    ctx.fillRect((food.x*blockSize), (food.y*blockSize), blockSize, blockSize);
  });
}

$(document).ready(function () {
  // Init GoInstant
  goinstant_init();
});

function respawn_snake(snakeUsername) {
  //spawn a new instance of the snake & destroy the old
  var new_x;
  var new_y;

  //Set length to default
  snake[snakeUsername].length = snakeLength;

  //Did the user hit a high score?
  if(snake[snakeUsername].highScore < snake[snakeUsername].score)
    snake[snakeUsername].highScore = snake[snakeUsername].score;

  //Reset score
  snake[snakeUsername].score = score;

  //Find new spawn location
  new_x = Math.round(Math.random()*(w-blockSize)/blockSize); 
  new_y = Math.round(Math.random()*(h-blockSize)/blockSize);

  //Set new direction
  switch(Math.round(Math.random()*3))
  {
    case 0: //up
      snake[snakeUsername].direction = 'up';
      break;
    case 1: //down
      snake[snakeUsername].direction = 'down';
      break;
    case 2: //left
      snake[snakeUsername].direction = 'left';
      break;
    case 3: //right
      snake[snakeUsername].direction = 'right';
      break;
  }

  //Setup new snake blocks
  snake[snakeUsername].blocks[0].x = new_x;
  snake[snakeUsername].blocks[0].y = new_y;

  for(var x = 1; x < snake[snakeUsername].length; x++) {
    snake[snakeUsername].blocks[x].x = snake[snakeUsername].blocks[x-1].x;
    snake[snakeUsername].blocks[x].y = snake[snakeUsername].blocks[x-1].y;

    if(snake[snakeUsername].direction == 'up')
      snake[snakeUsername].blocks[x].y--;
    if(snake[snakeUsername].direction == 'down')
      snake[snakeUsername].blocks[x].y++;
    if(snake[snakeUsername].direction == 'right')
      snake[snakeUsername].blocks[x].x--;
    if(snake[snakeUsername].direction == 'left')
      snake[snakeUsername].blocks[x].x++;
  }
  this.snakeKey.key("/" + snakeUsername).set(snake[snakeUsername], function(err) {
    if(err) throw err;
  });
}


//Draw canvas
function draw_canvas() {
  if(debug === true) {
    for(var x=0; x<(w/blockSize); x++) {
      for(var y=0; y<(h/blockSize); y++) {
        ctx.fillStyle = "white";
        ctx.fillRect((x*blockSize), (y*blockSize), blockSize, blockSize);
        ctx.strokeStyle = "black";
        ctx.strokeRect((x*blockSize), (y*blockSize), blockSize, blockSize);
      }
    }
  } else {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "black";
    ctx.strokeRect(0, 0, w, h);			
  }
}

// You can't have snakes without food!!
function create_food() {
  food = {
    x: Math.round(Math.random()*((w-200)-blockSize)/blockSize), 
    y: Math.round(Math.random()*(h-blockSize)/blockSize), 
  };
  foodKey.set(food, function(err) { if(err) throw err; });
}

// Get the user's name
function get_username() {
  myUserName = sessionStorage.getItem('gi_username');
  if (myUserName) return;

  myUserName = prompt('What is your name?', 'Guest');
  if (!myUserName) myUserName = 'Guest';
  sessionStorage.setItem('gi_username', myUserName);

  return;
} 
// Keyboard Controls
$(document).keydown(function(e){
  var key = e.which;
  if(key == "37" && snake[myUserName].direction != "right")
  snake[myUserName].direction = "left";
  else if(key == "38" && snake[myUserName].direction != "down")
  snake[myUserName].direction = "up";
  else if(key == "39" && snake[myUserName].direction != "left")
  snake[myUserName].direction = "right";
  else if(key == "40" && snake[myUserName].direction != "up") 
  snake[myUserName].direction = "down";

  snakeKey.key("/" + myUserName).set(snake[myUserName], function(err) {
    if(err) throw err;
  });

});


