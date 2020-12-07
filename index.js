const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const http = require('http').createServer(app);
const mqtt = require('mqtt');
const fs = require('fs');

// Configuracao do servidor
const serverConfig = {
    hostname: '127.0.0.1',
    port: 8080,
}

// Estado inicial do menu de configuracao do ar condicionado
var acState = {
    tMin: 16,
    tMax: 18,
    delay: 10,
    tOp: 17,
    power: false,
    powerOnIdle: true
}

// Dados dos sensores
var sensors = {
    temp: [],
    umid: [],
    movimento: [],
    luz: []
};

//=======================================================================
//
// Interação com o Boker MQTT
// https://github.com/mqttjs/MQTT.js
//
//=======================================================================

const brokerConfig = {
    endpoint: 'andromeda.lasdpc.icmc.usp.br',
    port: 8021,
    user: 'broker',
    pass: fs.readFileSync('./secret/broker.pass').toString(),
    teamId: '1',
    roomId: '2',
    acId: '23',
    auth: {
        key: fs.readFileSync('./secret/client.key'),
        cert: fs.readFileSync('./secret/client.crt'),
        caFile: fs.readFileSync('./secret/ca.crt')
    }
}

var options = {
    host: brokerConfig.endpoint,
    port: brokerConfig.port,
    protocol: 'mqtts',
    secureProtocol: 'TLSv1_method',
    protocolId: 'MQIsdp',
    rejectUnauthorized: true,
    username: brokerConfig.user,
    password: brokerConfig.pass,
    ca: [brokerConfig.auth.caFile],
    key: brokerConfig.auth.key,
    cert: brokerConfig.auth.cert,
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    debug: true
}; var client = mqtt.connect(options);

var msgFields = {
    msgCode: "0",
    tMax: "1",
    tMin: "2",
    delay: "3",
    tOp: "4",
    power: "21",
    powerOnIdle: "22",
    msgId: "23"
}

var msgCodes = {
    tMax: 4,
    tMin: 8,
    delay: 16,
    tOp: 32,
    power: 1,
    powerOnIdle: 2
}

//==========
// Publish
//==========

// Função que irá gerar o ID da mensagem para envia-la ao broker
// Não ficou claro qual é a heurística para fazer isso, então a função ainda não foi implementada
function newMsgId() {
    return 12345;
}

function getMsgCode(msgPayload) {    
    var sum = 0;
    Object.keys(msgPayload).forEach( key => {
        sum += msgCodes[key];
    })

    return sum;
}

// Funcao que gera o conteudo da mensagem de configuracao do ar condicionado a ser enviada
// Ela compara o novo estado solicitado pelo usuario com o estado atual e retorna
// apenas os campos que foram diferentes
function generateMsgPayload(newState) {
    var payload = {};

    Object.keys(newState).forEach( key => {
        if (newState[key] !== acState[key]) {
            payload[key] = newState[key];
        }
    })
    payload['msgCode'] = getMsgCode(payload);
    payload['msgId'] = newMsgId();

    return payload;
}

function serializePayload(payload) {
    msg = {};
    Object.keys(payload).forEach( key => {
        switch(key) {
            case "power":
                msg[msgFields[key]] = payload[key] ? 1 : 0;
                break;
            case "powerOnIdle":
                msg[msgFields[key]] = payload[key] ? 1 : 0;
                break;
            default:
                msg[msgFields[key]] = payload[key];
                break;
        }
    })
    return JSON.stringify(msg);
}

function publishAcState(newState) {
    var topic = `${brokerConfig.teamId}/aircon/${brokerConfig.acId}`;

    // Retorna apenas os campos que forem diferentes
    var payload = generateMsgPayload(newState)
    var msgStr = serializePayload(payload);
    

    // debug
    // console.log('')
    // console.log(`old state: ${JSON.stringify(acState)}`);    
    // console.log(`new state: ${JSON.stringify(newState)}`);
    // console.log(`payload: ${JSON.stringify(payload)}`);
    // console.log(`message: ${msgStr}`);
    client.publish(topic, msgStr);
}

//==========
// Subscribe
//==========

function subscribeToTopic(client, topic) {
    client.subscribe(topic, function (err) {
        if (!err) {
          console.log('Inscrito no topico '+topic)
        } else {
          console.log('Erro ao se inscrever no topico '+topic+': '+err);
        }
    })
}

function subscribeToSensor(client, sensorType, sensorId) {
    var topic = `${brokerConfig.roomId}/${sensorType}/${sensorId.toString()}`;
    subscribeToTopic(client, topic);
}

// Hard coded - mudar
client.on('connect', function () {
    subscribeToSensor(client, 'temp', 20);
    subscribeToSensor(client, 'temp', 21);
    subscribeToSensor(client, 'temp', 22);
    subscribeToSensor(client, 'umid', 20);
    subscribeToSensor(client, 'umid', 21);
    subscribeToSensor(client, 'umid', 22);
    subscribeToSensor(client, 'movimento', 25);
    subscribeToSensor(client, 'luz', 26);
    subscribeToTopic(client, `${brokerConfig.teamId}/response`);
})

client.on('message', function (topic, message) {
    var msgType = topic.split('/')[1];

    if (msgType === 'response') {
        processAcMsg(message);
    } else {
        processSensorMsg(topic, message);
    }
})

client.on('error', function(err){
    console.log(err)
    client.end()
})

//=======================================================================
//
// Funções auxiliares para o servidor
//
//=======================================================================

function processSensorMsg(topic, message) {
    var rawData = message.toString();
    var sensorType = topic.split('/')[1];

    data = parseSensorData(sensorType, rawData);

    var index = sensors[sensorType].findIndex(s => s.name === data.name);
    if (index === -1) {
        sensors[sensorType].push(data);
    } else {
        sensors[sensorType][index] = data;
    }
    
    // serverLog(`Dados de sensor: ${JSON.stringify(data)}`);
}

// Parsear mensagens dos topicos dos sensores
function parseSensorData(type, stringData) {
    data = JSON.parse(stringData);
    
    let v;
    switch (type) {
        case "movimento":
            v = 1;
            break;
        case "luz":
            v = data['21'];
            break;
        default:
            v = data[type];
            break;
    }
    return {
        name: data['0'],
        type: type,
        value: v

    };
}

function processAcMsg(message) {
    var rawData = message.toString();
    var data = parseAcData(rawData);
    
    setAcState(acState, data);
    
    console.log(message.toString());
    // console.log(acState)

    serverLog(`Dados do ar condicionado: ${JSON.stringify(data)}`);
}

function parseAcData(stringData) {
    data = JSON.parse(stringData);

    return {
        tMax: data[msgFields['tMax']],
        tMin: data[msgFields['tMin']],
        delay: data[msgFields['delay']],
        tOp: data[msgFields['tOp']],
        power: (data[msgFields['power']] === 1),
        powerOnIdle: (data[msgFields['powerOnIdle']] === 1),
        msgId: data[msgFields['msgId']]
    }
}

// function parseTimestamp(tsString) {
//     var pattern = /(\d{2})\/(\d{2})\/(\d{4})\ (\d{2}):(\d{2}):(\d{2})/
//     return new Date(tsString.replace(pattern,'$3-$2-$1T$4:$5:$6'));
// }

function generateTimestamp() {
    var now = new Date(); 
    return (
        "00" + (now.getMonth() + 1)).slice(-2) + "/" + (
        "00" + now.getDate()).slice(-2) + "/" + now.getFullYear() + " " + (
        "00" + now.getHours()).slice(-2) + ":" + (
        "00" + now.getMinutes()).slice(-2) + ":" + (
        "00" + now.getSeconds()).slice(-2);
}

function castStateParams(reqBody) {
    return {
        tMin: parseInt(reqBody.tMin),
        tMax: parseInt(reqBody.tMax),
        tOp: parseInt(reqBody.tOp),
        delay: parseInt(reqBody.delay),
        powerOnIdle: (reqBody.powerOnIdle === 'true')
    }
}

function validStateParams(params) {
    if (params.tMin < 16 || params.tMin > 22) {
        return false;
    }
    if (params.tMax < 17 || params.tMax > 23) {
        return false;
    }
    if (params.tMax < params.tMin) {
        return false;
    }
    if (params.Delay < 1 || params.Delay > 120) {
        return false;
    }
    if (params.tOp < params.tMin || params.tOp > params.tMax) {
        return false;
    }
    return true;
}

function setAcState(state, params) {
    Object.keys(params).forEach( key => {
        if (key in state) {
            state[key] = params[key];
        }
    })
    return state;
}

// Log com timestamp
function serverLog(msg) {
    console.log(`${generateTimestamp()} ${msg}`);
}

//=======================================================================
//
// Roteamento e definição do servidor
//
//=======================================================================

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.route('/state')
    .get( (req, res) => {
        res.send(acState);
    })
    .post( (req, res) => {        
        params = castStateParams(req.body);

        if (validStateParams(params)) {
            publishAcState(params);

            serverLog(`Nova configuracao recebida: ${JSON.stringify(acState)}`);
            res.status(200);
        } else {
            serverLog(`Configuracao invalida recebida: ${JSON.stringify(acState)}`);
            res.sendStatus(400);
        }
    })
;

app.get('/sensors', (req, res) => {
    res.send(sensors);
})
    
app.post('/power', (req, res) => {
    publishAcState({power: !acState.power});
    serverLog(`Nova configuracao recebida: ${JSON.stringify(acState)}`);
    res.status(200);
})

app.use(function(req, res, next) {
    res.status(404).send('Página não foi encontrada.');
});

http.listen(serverConfig.port, () => {
  serverLog(`Servidor da aplicacao rodando em http://localhost:${serverConfig.port}`);
})