var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Canvas = require('canvas')
    , Image = Canvas.Image
    , blobCanvas = new Canvas(640,640)
    , blobCanvasContext = blobCanvas.getContext('2d');

var Worker = require('webworker-threads').Worker;


app.get('/', function(req, res){
    res.sendfile('index.html');
});
app.get('/rooms/create', function(req, res){
    res.sendfile('create_room.html');
});








var totalClients = 0;
var players = new Array();
var mapControlArray;

io.on('connection', function(socket){
    console.log('a user connected');
    var player = new Player("Player " + totalClients);

    player.ID = totalClients;
    totalClients += 1;

    //send the new player to all of the current clients
    io.emit("player setup", { ID: player.ID, Color: player.Color, X: player.X, Y: player.Y });

    //now send all of the existing players to the new player
    for (var i = 0; i < players.length; i++)
    {
        socket.emit("player setup", { ID: players[i].ID, Color: players[i].Color, X: players[i].X, Y: players[i].Y });
    }
    socket.emit("initial blobs", blobCanvas.toDataURL());

    if (mapControlArray != undefined)
    {
        socket.emit("map control", mapControlArray);
    }

    players.push(player);

    socket.emit("player id", player.ID); //send the player's ID to ONLY the client and no one else

    socket.on('chat message', function(msg)
    {
        player.onChatMessage(msg);
        console.log('message: ' + msg);
        io.emit('chat message', msg);
    });

    socket.on('position', function(x, y)
    {
        player.onPositionUpdate(x, y);
    });

    socket.on('disconnect', function()
    {
        socket.emit("client disconnected", { ID: player.ID });
       players.splice(players.indexOf(player), 1);
    });

});

http.listen(3000, function(){
    console.log('listening on *:3000');
});

var dah = 0;

function Player(name)
{
    this.ID = 0;
    this.X = 50;
    this.Y = 50;
    this.Name = name;
    this.onChatMessage = function(msg)
    {
        console.log("player class chat message: " + msg);
    }

    this.onPositionUpdate = function(x, y)
    {
        dah += 1;
        console.log(this.Name + " moved " + x + "," + y);

        this.X = x;
        this.Y = y;

        var forceUpdate = false;
        if (this.X > 550)
        {
            this.X = 550;
            forceUpdate = true;
        }
        if (this.X < 0)
        {
            this.X = 0;
            forceUpdate = true;
        }
        if (this.Y > 650)
        {
            this.Y = 650;
            forceUpdate = true;
        }
        if (this.Y < 0)
        {
            this.Y = 0;
            forceUpdate = true;
        }


    //    console.log(this.X + "," + this.Y);
        io.emit("player moved", { ID: this.ID, X: this.X, Y: this.Y, ForceUpdate: forceUpdate });

        var blobX = this.X;
        var blobY = this.Y;



        io.emit("new blob", { Color: this.Color, X: blobX, Y: blobY});

        blobCanvasContext.beginPath();
        blobCanvasContext.fillStyle = this.Color;
        blobCanvasContext.arc(blobX, blobY, 32, 0, 2 * Math.PI);
        blobCanvasContext.fill();


        if (dah % 100 == 0)
        {
            /*
            mapControlArray = getAverageRGB(function () {
                console.log(mapControlArray.length + " colors");


                for (var i = 0; i < mapControlArray.length; i++) {
                    console.log(mapControlArray[i].key + " = " + mapControlArray[i].value);
                }
            });
            */
        }



    }
    this.Color = getRandomColor();



    
}

setTimeout(EndGame, 120000);
function EndGame()
{

    //{key: key, value: colors[key]});
    mapControlArray = getRGB();

    console.log(mapControlArray.length + " colors");


    for (var i = 0; i < mapControlArray.length; i++) {
        console.log(mapControlArray[i].key + " = " + mapControlArray[i].value);
    }

    io.emit("map control", mapControlArray);



}
function getRGB()
{

    var blockSize = 8, // only visit every 5 pixels
        defaultRGB = "#000000",// for non-supporting envs
        data, width, height,
        i = -4,
        length,
        rgb = {r:0,g:0,b:0},
        count = 0;

    if (!blobCanvasContext) {
        return defaultRGB;
    }

    height = blobCanvas.height;
    width = blobCanvas.width;


    var t1 = new Date().getTime();
    try {
        data = blobCanvasContext.getImageData(0, 0, width, height);
    } catch(e) {
        /* security error, img on diff domain */
        return defaultRGB;
    }

    var t2 = new Date().getTime();

    console.log("getImageData took " + (t2 - t1) + "ms");

    length = data.data.length;

    var colors = {};


    t1 = new Date().getTime();
    while ( (i += blockSize * 4) < length ) {
        ++count;



        var colorHex = rgbToHex(data.data[i], data.data[i+1], data.data[i+2]);
        if (colorHex == defaultRGB)
        {
            continue;
        }

        if (colors[colorHex] == undefined)
        {
            colors[colorHex] = 0;
        }
        colors[colorHex] += 1;
    }

    t2 = new Date().getTime();

    console.log("loop took " + (t2 - t1) + "ms");


    t1 = new Date().getTime();
    var sortableArray = new Array();
    for (var key in colors)
    {
        if (colors[key] > 1000) { //ignore all below 1000
            sortableArray.push({key: key, value: colors[key]});
        }
    }

    sortableArray.sort(function(a, b)
    {

        if(a.value > b.value){
            return -1;
        }
        else if(a.value < b.value){
            return 1;
        }
        return 0;
    });
    t2 = new Date().getTime();

    console.log("loop2 took " + (t2 - t1) + "ms");
    return sortableArray;

}



function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}



function getSortedKeys(obj) {
    var keys = []; for(var key in obj) keys.push(key);
    return keys.sort(function(a,b){return obj[a]-obj[b]});
}
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}