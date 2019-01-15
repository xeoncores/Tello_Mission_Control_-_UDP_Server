/*
2019-01-08
Marco Martinez
*/

//CONSOLE COLORS
const colors = require('colors');
//EXPRESS HTTP SERVER
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
//FILE SYSTEM READ WRITE FILES
const fs = require('fs');
//UPP
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const status = dgram.createSocket('udp4');

const server_port = 3000;//Express HTTP Server PORT
const frame_rate = 60;//ANIMATION FRAME RATE

//UDP PORTS
const port = 8889;//TELLO PORT
const port_status = 8890;//TELLO STATUS PORT
//LEVEL CMD Desired Height
const level_height = 110;

//DRONE DISTANCE
const drone_dist = 20;

//DRON THROW TAKEOFF Z FORCE
const throw_force = 50;

let commands = {};//OBJECT STATS AND COMMANDS HOLDER

const jsonParser = bodyParser.json();
//CONSOLE WELCOME
fs.readFile('banner/_2', 'utf8', function(err, banner) {
  console.log(banner.cyan);
  console.log('OPEN THE FOLLOWING URL NN YOUR INTERNET BROWSER'.white);
  console.log(`http://localhost:${server_port}/\n`.inverse);
  console.log('TO STOP THE SERVER USE'.white);
  console.log(`CTR+C\n`.inverse);
  console.log('HAVE FUN :P'.cyan);
});

//UDP CLIENT SERVER
server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});
server.on('message', (msg, rinfo) => {
  //UNCOMNET FOR DEBUG
  console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  nextCMD(rinfo.address);
});
server.on('listening', () => {
  let address = server.address();
  //UNCOMNET FOR DEBUG
  //console.log(`UDP CMD RESPONSE SERVER - ${address.address}:${address.port}`);
});
server.bind(port);
//UDP STATUS SERVER
status.on('listening', function () {
    let address = status.address();
    //UNCOMNET FOR DEBUG
    //console.log(`UDP STATUS SERVER - ${address.address}:${address.port}`);
});
status.on('message', function (message, remote) {
    //UNCOMNET FOR DEBUG
    //console.log(`${remote.address}:${remote.port} - ${message}`);
    let msg_obj = dataSplit(message.toString());
    if(commands.hasOwnProperty(remote.address)){
      commands[remote.address]['status'] = msg_obj;
    }
    else{
      commands = Object.assign(commands, {[remote.address]: { status: msg_obj }})
    }
});
status.bind(port_status);




//EXPRESS SERVER
app.use('/', express.static('public'));
app.get('/test', function (req, res) {
  res.send('Hello World');
});

//GET REQUEST
app.get('/getKeys', function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, file) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    res.send(file)
  });
});
//ADD NEW KEY
app.post('/addKeys', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let keysObj = JSON.parse(keys);
      let drone = req.body.drone;
      keysObj.command_values[drone].push(req.body);
      keysObj.drone_commands[drone].push(getCommand(req.body));
      keysObj.drone_keys[drone] = getFrames(keysObj.drone_keys[drone], req.body, drone);
      //JSON UPDATE & RESPONSE
      let KeysJSON = JSON.stringify(keysObj);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(KeysJSON);
        }
      });
    }
  });
});
//UPDATE KEYS
app.post('/updateKeys', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let keysObj = JSON.parse(keys);
      let drone = req.body.drone;
      let frame = req.body.frame;
      let address = req.body.address;

      keysObj.command_values[drone][frame] = req.body;
      keysObj.drone_commands[drone][frame] = getCommand(req.body);  
      keysObj.drone_address[drone] = address;
      keysObj.drone_keys[drone] = [];
      for(let n in keysObj.command_values[drone]){
        keysObj.drone_keys[drone] = getFrames(keysObj.drone_keys[drone], keysObj.command_values[drone][n], drone);// PENDING
      }
      //JSON UPDATE & RESPONSE
      let KeysJSON = JSON.stringify(keysObj);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(KeysJSON);
        }
      });
    }
  });
});
//DELETE KEYS
app.post('/deleteKeys', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let keysObj = JSON.parse(keys);
      let drone = req.body.drone;
      let frame = req.body.frame;

      keysObj.command_values[drone].splice(frame, 1);
      keysObj.drone_commands[drone].splice(frame, 1);
      keysObj.drone_keys[drone] = [];
      for(let n in keysObj.command_values[drone]){
        keysObj.drone_keys[drone] = getFrames(keysObj.drone_keys[drone], keysObj.command_values[drone][n], drone);// PENDING
      }
      //JSON UPDATE & RESPONSE
      let KeysJSON = JSON.stringify(keysObj);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(KeysJSON);
        }
      });
    }
  });
});
//ADD DRONE
app.post('/addDronne', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let keysObj = JSON.parse(keys);
      let drone = req.body.drone;
      keysObj.drone_keys.push(keysObj.drone_keys[drone]);
      keysObj.command_values.push(keysObj.command_values[drone]);
      keysObj.drone_commands.push(keysObj.drone_commands[drone]);
      keysObj.drone_address.push(keysObj.drone_address[drone]);
      //JSON UPDATE & RESPONSE
      let KeysJSON = JSON.stringify(keysObj);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(KeysJSON);
        }
      });
    }
  });
});
//REMOVE DRONE
app.post('/removeDronne', jsonParser, function (req, res) {
  fs.readFile('keys.json', 'utf8', (err, keys) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error('myfile does not exist');
        return;
      }
      throw err;
    }
    else{
      let keysObj = JSON.parse(keys);
      let drone = req.body.drone;
      keysObj.drone_keys.splice(drone, 1);
      keysObj.command_values.splice(drone, 1);
      keysObj.drone_commands.splice(drone, 1);
      keysObj.drone_address.splice(drone, 1);
      
      //JSON UPDATE & RESPONSE
      let KeysJSON = JSON.stringify(keysObj);
      fs.writeFile('keys.json', KeysJSON, (err) => {
        if (err) throw err;
        else{
          res.send(KeysJSON);
        }
      });
    }
  });
});
app.post('/sendCommands', jsonParser, function (req, res) {// SEND COMMANDS TO DRONE
  commands = null;
  commands = req.body;
  startCMD();
  res.send(commands);
});
app.post('/getStatus', jsonParser, function (req, res) {//GET STATUS FROM DRONE
  if(commands.hasOwnProperty(req.body.drone)){
    res.send(commands[req.body.drone].status);
  }
  else{
    res.send({Status: 'Offline'});
  }
  
});
app.get('/getAllStatus', function (req, res) {
  res.send(commands);
});

app.listen(server_port);//START EXPRESS SERVER


//ANNIMATION FUNCTIONS
function getCommand(values){
  switch(values.command) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
      case 'forward':
      case 'back':
        return `${values.command} ${values.x}`;
        break;
      case 'cw':
      case 'ccw':
          return `${values.command} ${values.deg}`;
          break;
      case 'flip':
          return `${values.command} ${values.dir}`;
          break;
      case 'go':
          return `${values.command} ${values.x} ${values.y} ${values.z} ${values.speed}`;
          break;
      case 'wait':
          return `${values.x}`;
          break;
      case 'curve':
          return `${values.command} ${values.x1} ${values.y1} ${values.z1} ${values.x2} ${values.y2} ${values.z2} ${values.speed}`;
          break;
      default:
          return values.command;//level
  }
}
function getFrames(keys, values, drone){//SET ANIMATION FRAMES
  if(keys.length == 0){
      keys.push({type: 'position',ani_type: 'ANIMATIONTYPE_VECTOR3',ani_mode: 'ANIMATIONLOOPMODE_CYCLE',keys: [{frame: 0,value: {x: (drone * drone_dist),y: 0,z: 0}}]});
      return keys;
  }
  let speed = 50;
  let anim_type = getFrameType(values.command);
  let last_frame_type = keys[keys.length -1];
  let last_frame = last_frame_type.keys[last_frame_type.keys.length -1];
  switch(values.command) {
      case 'up':
        if(last_frame_type.type == anim_type.type){
          let dest = {x: last_frame.value.x  + (drone * drone_dist), y: last_frame.value.y + values.x, z: last_frame.value.z};
          keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
        }
        else{
          console.log('FALSE')
        }
        break;
      case 'down':
        if(last_frame_type.type == anim_type.type){
          let dest = {x: last_frame.value.x  + (drone * drone_dist), y: last_frame.value.y - values.x, z: last_frame.value.z};
          keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
        }
        else{
          console.log('FALSE')
        }
        break;
      case 'left':
        if(last_frame_type.type == anim_type.type){
          let dest = {x: (last_frame.value.x  + (drone * drone_dist)) - values.x, y: last_frame.value.y, z: last_frame.value.z};
          keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
        }
        else{
          console.log('FALSE')
        }
        break;
      case 'right':
        if(last_frame_type.type == anim_type.type){
          let dest = {x: last_frame.value.x  + (drone * drone_dist) + values.x, y: last_frame.value.y, z: last_frame.value.z};
          keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
        }
        else{
          console.log('FALSE')
        }
        break;
      case 'forward':
        if(last_frame_type.type == anim_type.type){
          let dest = {x: last_frame.value.x  + (drone * drone_dist), y: last_frame.value.y, z: last_frame.value.z - values.x};
          keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
        }
        else{
          console.log('FALSE')
        }
        break;
      case 'back':
        if(last_frame_type.type == anim_type.type){
          let dest = {x: last_frame.value.x  + (drone * drone_dist), y: last_frame.value.y, z: last_frame.value.z + values.x};
          keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
        }
        else{
          console.log('FALSE')
        }
        break;
      case 'go':
//x, y, z
//x:Left/Rigth, y: Up/Down z: Forward/Backward - 3D
//x:Forward/Backward y: Left/Rigth, z: Up/Down - DRONE
//let dest = {x: 50, y: 50, z: 50};
//last_frame.value.x
          if(last_frame_type.type == anim_type.type){
              let dest = {x: (last_frame.value.x  + (drone * 20)) + minVal(values.y), y: last_frame.value.y + minVal(values.z), z: last_frame.value.z - minVal(values.x)};
              keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
          }
          else{
              console.log('FALSE')
          }
          break;
      case 'takeoff':
          if(last_frame_type.type == anim_type.type){
              let dest = {x: last_frame.value.x, y: 50, z: last_frame.value.z};
              keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(10, last_frame.value, dest)), value: dest});
          }
          else{
              console.log('FALSE')
          }
          break
      case 'land':
          if(last_frame_type.type == anim_type.type){
              let dest = {x: last_frame.value.x, y: 0, z: last_frame.value.z};
              keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
          }
          else{
              console.log('FALSE')
          }
          break;
      case 'flip':
          //return `${values.command} ${values.dir}`;
          break;
      case 'curve':
          //return `${values.command} ${values.x1} ${values.y1} ${values.z1} ${values.x2} ${values.y2} ${values.z2} ${values.speed}`;
          break;
      case 'command':
          if(last_frame_type.type == anim_type.type){
            //TODO:
              keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(0, last_frame.value, last_frame.value)), value: last_frame.value});
          }
          else{
            console.log('FALSE')
          }
          break;
      case 'level':
          if(last_frame_type.type == anim_type.type){
              let dest = {x: last_frame.value.x, y: 110, z: last_frame.value.z};
              keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * getFrameDuration(speed, last_frame.value, dest)), value: dest});
          }
          else{
              console.log('FALSE')
          }
          break;
      case 'wait':
          if(last_frame_type.type == anim_type.type){
          //TODO:
            keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * parseInt(values.x, 0)), value: last_frame.value});
          }
          else{
            console.log('FALSE')
          }
          break;
      default://Wait
          console.log('ELSE')
        if(last_frame_type.type == anim_type.type){
        //TODO:
          keys[keys.length -1].keys.push({frame: last_frame.frame + (frame_rate * parseInt(values.x, 0)), value: last_frame.value});
        }
        else{
          console.log('FALSE')
        }
  }
  return keys;
}
function getFrameDuration(speed, a, b){//CALCULATE NEXT FRAME DURATION BASED ON SPEED AND DISTANCE TRAVEL
  let max_travel = 0;
  let arr = Object.keys(b);
  for(let i in arr){
      let temp = Math.abs(b[arr[i]] - a[arr[i]]);
      if(temp > max_travel){
          max_travel = temp;
      }
  }
  let res = parseInt(max_travel / speed, 0);
  if(res > 1){
      return res;
  }
  else return 1;
}
function getFrameType(command){//GET ANIMATION TYPE AND MODE
  switch(command) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
      case 'forward':
      case 'back':
      case 'takeoff':
      case 'land':
      case 'go':
      case 'level':
      case 'wait':
      case 'command':
          return {type: 'position', ani_type: 'ANIMATIONTYPE_VECTOR3',ani_mode: 'ANIMATIONLOOPMODE_CYCLE'};
          break;
      case 'flip':
          //return `${values.command} ${values.dir}`;
          break;
      case 'curve':
          //return `${values.command} ${values.x1} ${values.y1} ${values.z1} ${values.x2} ${values.y2} ${values.z2} ${values.speed}`;
          break;
      default:
          return {type: 'position', ani_type: 'ANIMATIONTYPE_VECTOR3',ani_mode: 'ANIMATIONLOOPMODE_CYCLE'};
  }
}

//UDP FUNCTIONS
async function startCMD(){
  let arr = Object.keys(commands);
  for(let i in arr){
    await senCMD(arr[i], commands[arr[i]]['cmd_list'][0]).catch((e) => console.log(e)).then((res) => console.log(res));
  }
  return 'OK';
}

function dataSplit(str){//Create JSON OBJ from String  "key:value;"
  let data = {};
  let arrCMD = str.split(';');  
  for(let i in arrCMD){
    let tmp = arrCMD[i].split(':');
    if(tmp.length > 1){
      data[tmp[0]] = tmp[1];
    }
  }
  return data;
}
//SEND COMMANDS
function senCMD(tello, command) {//SEND COMMAND TO TELLO OR SPECIAL FUNCTIONS
  if (parseInt(command, 0)) {//WAIT TIMMER FUNCTION
    return new Promise((resolve, reject) => {
      setTimeout(function () {
        nextCMD(tello);
        resolve('OK');
      }, parseInt(command, 0) * 1000);
    });
  }
  else if(command == 'throw'){//DRONE RESPONDS WIRH ERROR
    return new Promise((resolve, reject) => {
      let inter = setInterval(function(){
        if(commands[tello]['status']['agz'] > throw_force){
          let msg = Buffer.from('takeoff');
          server.send(msg, 0, msg.length, port, tello, function (err) {
            clearInterval(inter);
            if (err) {
              console.error(err);
              reject(`ERROR : ${command}`);
            } else{
              resolve('OK');
            }
          });
        }
      }, 10);
    });
  }
  else if(command == 'level'){// SET DRONE TO DESIRE LEVEL, CHECK CURRENT HEIGHT ANS SEND COMMAND TO MACH
    return new Promise((resolve, reject) => {
      let msg = null;
      let h =  parseInt(commands[tello]['status']['h'], 0);
      if(h < level_height){
        msg = Buffer.from(`up ${level_height - h}`);
        console.log(`up ${level_height - h}`)
      }
      else if(h > level_height){
        msg = Buffer.from(`down ${h - level_height}`);
        console.log(`down ${h - level_height}`)
      }
      else{
        msg = Buffer.from('wifi?');
      }      
      server.send(msg, 0, msg.length, port, tello, function (err) {
        if (err) {
          console.error(err);
          reject(`ERROR : ${command}`);
        } else resolve('OK');
      });
    });
  }
  else if(command == 'close'){//CLOSE UDP CONNECTION
    return new Promise((resolve, reject) => {
      server.close();
      server.unref();
      resolve('OK');
    });
  }
  else{//DEFAULT - SEND COMMAND TO TELLO DRONE
    return new Promise((resolve, reject) => {
      let msg = Buffer.from(command);
      server.send(msg, 0, msg.length, port, tello, function (err) {
        if (err) {
          console.error(err);
          reject(`ERROR : ${command}`);
        } else resolve('OK');
      });
    });
  }
}
function nextCMD(tello) {//GET NEXT COMMAND IN LINE
  if (commands.hasOwnProperty(tello)) {
    let cmd = commands[tello]['cmd_list'];
    if (cmd.length > 1) {
      cmd.shift();
      senCMD(tello, commands[tello]['cmd_list'][0]);
    } else {
      console.log('ALL CMD SENT');
    }
  } else {
    console.log('Drone Not Found');
  }
}
function minVal(val){
  if(val > 20 || val < -20){
    return val;
  }
  else return 0;
}
function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms)
  })
}