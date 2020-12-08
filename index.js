const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const fs = require('fs');
const mqtt = require('mqtt');

// Lendo arquivos de configuracao e credenciais
const msgFields = JSON.parse(fs.readFileSync('config/message_fields.json'));
const msgCodes = JSON.parse(fs.readFileSync('config/message_codes.json'));
const sensorsConfig = JSON.parse(fs.readFileSync('config/sensors.json'));

const serverConfig = JSON.parse(fs.readFileSync('config/server.json'));
const serverCredentials = {
    key: fs.readFileSync(serverConfig.https.cert.keyFile),
    cert: fs.readFileSync(serverConfig.https.cert.certFile),
}

const brokerConfig = JSON.parse(fs.readFileSync('config/broker.json'));
const brokerCredentials = {
    pass: fs.readFileSync(brokerConfig.auth.passFile).toString(),
    key: fs.readFileSync(brokerConfig.auth.keyFile).toString(),
    cert: fs.readFileSync(brokerConfig.auth.certFile).toString(),
    ca: fs.readFileSync(brokerConfig.auth.caFile).toString()
}

// Instanciando servidores http e https
const http = require('http').createServer(app);
const https = require('https').createServer(serverCredentials, app);

// Estado inicial do menu de configuracao do ar condicionado (MOCK)
var acState = {
    tMin: 16,
    tMax: 18,
    delay: 10,
    tOp: 17,
    power: false,
    powerOnIdle: true
}

// Inicializando sensores
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

// Conectando com broker
var clientConfig = {
    host: brokerConfig.endpoint,
    port: brokerConfig.port,
    protocol: "mqtts",
    secureProtocol: "TLSv1_method",
    protocolId: "MQIsdp",
    protocolVersion: 3,
    username: brokerConfig.auth.user,
    password: brokerCredentials.pass,
    ca: [brokerCredentials.ca],
    key: brokerCredentials.key,
    cert: brokerCredentials.cert
}; var client = mqtt.connect(clientConfig);

//==========
// Publish
//==========

// Semaforo para a publicacao de estados (travar o servidor até que Broker responda)
var publishSignal = false;
var receiveSignal = false;
var currentMsgId = -1;
function serverLock(){
    return new Promise( (resolve, reject) => {
        setTimeout( () => {
            reject();
        }, brokerConfig.publishTimeoutMs);
        function lock() {
            if(publishSignal && receiveSignal) {
                return resolve();
            }
            setTimeout(lock, 0);
        }
        setTimeout(lock, 0);
    });
}

function acquirePublishLock(msgId) {
    publishSignal = true;
    currentMsgId = msgId;
}

function releasePublishLock() {
    publishSignal = false;
    receiveSignal = false;
    currentMsgId = -1;
}

function generateMessageID() {
    var now = new Date();
    return Number(`${now.getDay()}${now.getHours()}${now.getMinutes()}${now.getSeconds()}${now.getMilliseconds()}`);
}

// Computa o codigo da mensagem a ser enviada
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
    payload['msgId'] = generateMessageID();

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
    var payload = generateMsgPayload(newState);
    var msgStr = serializePayload(payload);
    
    console.log(`sent: ${msgStr}`);
    
    acquirePublishLock(payload.msgId);

    client.publish(topic, msgStr);
}

//===========
// Subscribe
//===========

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

client.on('connect', function () {
    sensorsConfig.forEach(sensor => {
        subscribeToSensor(client, sensor.type, sensor.id);
    })
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
    
    if (serverConfig.logSensorData) {
        serverLog(`Dados de sensor: ${JSON.stringify(data)}`);
    }
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
    
    if (data.msgId === currentMsgId) {
        setAcState(acState, data);
        receiveSignal = true;
        serverLog(`Novo estado do ar condicionado configurado: ${JSON.stringify(data)}`);

        console.log(`received: ${message.toString()}`);
    }
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
        statesSent = false;
        statesReceived = false;
        params = castStateParams(req.body);

        if (validStateParams(params)) {
            serverLog(`Nova configuracao recebida: ${JSON.stringify(params)}`);

            publishAcState(params);

            serverLock().then( () => {
                releasePublishLock();
                res.sendStatus(200);
            }, () => {
                console.log('Timeout na comunicacao com o Broker');
                releasePublishLock();
                res.sendStatus(500);
            });
        } else {
            serverLog(`Configuracao invalida recebida: ${JSON.stringify(param)}`);
            res.sendStatus(400);
        }
    })
;

app.get('/sensors', (req, res) => {
    res.send(sensors);
})
    
app.post('/power', (req, res) => {
    var params = {power: !acState.power};
    publishAcState(params);
    serverLog(`Nova configuracao recebida: ${JSON.stringify(params)}`);

    serverLock().then( () => {
        releasePublishLock();
        res.sendStatus(200);
    }, () => {
        console.log('Timeout na comunicacao com o Broker');
        releasePublishLock();
        res.sendStatus(500);
    });
})

app.use(function(req, res, next) {
    res.status(404).send('Página não foi encontrada.');
});

if (serverConfig.http.enabled) {
    http.listen(serverConfig.http.port, () => {
    serverLog(`Servidor da aplicacao rodando em http://localhost:${serverConfig.http.port}`);
    })
}

if (serverConfig.https.enabled) {
    https.listen(serverConfig.https.port, () => {
        serverLog(`Servidor da aplicacao rodando em http://localhost:${serverConfig.https.port}`);
    })
}