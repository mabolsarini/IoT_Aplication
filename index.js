const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const fs = require('fs');
const mqtt = require('mqtt');
const { google } = require('googleapis');
var path = require('path');

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
function publishLock() {
    return new Promise( (resolve, reject) => {
        function lock() {
            if(publishSignal && receiveSignal) {
                return resolve();
            }
            setTimeout(lock, 0);
        }
        setTimeout( () => {
            reject();
        }, brokerConfig.publishTimeoutMs);
        setTimeout(lock, 0);
    });
}

function signalPublished(msgId) {
    publishSignal = true;
    currentMsgId = msgId;
}

function signalReceived() {
    receiveSignal = true;
}

function releaseLock() {
    publishSignal = false;
    receiveSignal = false;
    currentMsgId = -1;
}

// Semaforo para a conexao com Broker
var connectedSignal = false;
function connectedToBroker() {
    return new Promise( (resolve, reject) => {
        function lock() {
            if (connectedSignal) {
                return resolve();
            }
            setTimeout(lock, 0);
        }
        setTimeout( () => {
            reject();
        }, brokerConfig.connectionTimeoutMs);
        setTimeout(lock, 0);
    });
}

function signalConnected() {
    connectedSignal = true;
}

// Funcoes auxiliares
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
    
    signalPublished(payload.msgId);
    client.publish(topic, msgStr);

    // debug
    console.log(`sent: ${msgStr}`);
}

async function getAcState() {    
    var topic = `${brokerConfig.teamId}/aircon_status/${brokerConfig.acId}`;
    var payload = { msgId: generateMessageID() };
    var msgStr = serializePayload(payload);

    signalPublished(payload.msgId);
    client.publish(topic, msgStr);

    var ok = await publishLock().then( () => {
        releaseLock();
        return true;
    }, () => {
        releaseLock();
        serverLog('Timeout na comunicacao com o Broker ao buscar o estado do Ar Condicionado');
        return false;
    });

    return ok;
}

//===========
// Subscribe
//===========

// Fazer block do servidor a partir da conexão com o tópico 1/response !!
function subscribeToTopic(client, topic) {
    client.subscribe(topic, function (err) {
        if (!err) {
            serverLog(`Inscrito no topico ${topic}`);
        } else {
            serverLog(`Erro ao se inscrever no topico ${topic}: ${err}`);
        }
    })
}

function subscribeToSensor(client, sensorType, sensorId) {
    var topic = `${brokerConfig.roomId}/${sensorType}/${sensorId.toString()}`;
    subscribeToTopic(client, topic);
}

client.on('connect', function () {
    sensorsConfig.forEach(sensor => {
        subscribeToTopic(client, `${brokerConfig.roomId}/${sensor.type}/${sensor.id.toString()}`);
    })
    subscribeToTopic(client, `${brokerConfig.teamId}/response`);
    signalConnected();
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
    serverLog(`Erro no cliente MQTT: ${err}`);
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
        signalReceived();

        serverLog(`Novo estado do ar condicionado configurado: ${JSON.stringify(data)}`);

        // debug
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

function stopServer(msg) {
    serverLog(msg);
    client.end()
    process.exit();
}

//=======================================================================
//
// Roteamento e definição do servidor
//
//=======================================================================

// Login

const googleConfig = {
    clientId: '533599554971-r4v411ohc19409aqkobbn98a05n90tes.apps.googleusercontent.com',
    clientSecret: 'xFuynIbrURArdAB6TZB4l8Zt',
    redirect: 'https://localhost:8443/auth'
};

const defaultScope = [
    'https://www.googleapis.com/auth/plus.me',
    'https://www.googleapis.com/auth/userinfo.email',
];

function createConnection() {
    return new google.auth.OAuth2(
        googleConfig.clientId,
        googleConfig.clientSecret,
        googleConfig.redirect
    );
}

function getConnectionUrl(auth) {
    return auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: defaultScope
    });
}

function googleAuthUrl() {
    return getConnectionUrl(createConnection());
}

// function getGoogleAccountFromCode(code) {
//     const data = await auth.getToken(code);
//     const tokens = data.tokens;
//     const auth = createConnection();
//     auth.setCredentials(tokens);
//     const plus = getGooglePlusApi(auth);
//     const me = await plus.people.get({ userId: 'me' });
//     const userGoogleId = me.data.id;
//     const userGoogleEmail = me.data.emails && me.data.emails.length && me.data.emails[0].value;
//     return {
//       id: userGoogleId,
//       email: userGoogleEmail,
//       tokens: tokens,
//     };
// }

// Middlewares

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Middleware de autenticação
app.use( (req, res, next) => {
    // codar
    next();
})

app.get('/', (req, res) => {
    res.redirect(googleAuthUrl());
})

app.get('/auth', (req, res) => {
    res.redirect('/app');
})

app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
})

app.route('/state')
    .get( (req, res) => {
        res.send(acState);
    })
    .post( async (req, res) => {        
        params = castStateParams(req.body);

        if (validStateParams(params)) {
            serverLog(`Nova configuracao recebida: ${JSON.stringify(params)}`);

            publishAcState(params);

            await publishLock().then( () => {
                releaseLock();
                res.sendStatus(200);
            }, () => {
                serverLog('Timeout na comunicacao com o Broker');
                releaseLock();
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
    
app.post('/power', async (req, res) => {
    var params = {power: !acState.power};
    publishAcState(params);
    serverLog(`Nova configuracao recebida: ${JSON.stringify(params)}`);

    await publishLock().then( () => {
        releaseLock();
        res.sendStatus(200);
    }, () => {
        serverLog('Timeout na comunicacao com o Broker');
        releaseLock();
        res.sendStatus(500);
    });
})

app.use( (req, res, next) => {
    res.status(404).send('Página não foi encontrada.');
});

async function runServer() {
    serverLog('Connectando ao Broker...');
    var connected = await connectedToBroker().then( () => {
        return true;
    }, () => {
        serverLog('Timeout ao se conectar ao Broker');
        return false;
    } );

    if (!connected) {
        stopServer('Não foi possivel se conectar ao Broker');
    } else {
        serverLog('Connectado ao Broker');
    }

    serverLog('Buscando estado atual do Ar Condicionado');

    var stateSet = await getAcState();
    if (!stateSet) {
        stopServer('Nao foi possivel buscar o estado do Ar Condicionado');
    } else {
        serverLog('Estado do Ar Condicionado configurado');
    }
    
    if (connected && stateSet) {
        if (serverConfig.https.enabled) {
            https.listen(serverConfig.https.port, () => {
                serverLog(`Servidor HTTP da aplicacao rodando em http://${serverConfig.hostname}:${serverConfig.https.port}`);
            })
        }
        if (serverConfig.http.enabled) {
            http.listen(serverConfig.http.port, () => {
                serverLog(`Servidor HTTPS da aplicacao rodando em http://${serverConfig.hostname}:${serverConfig.http.port}`);
            })
        }
    }
}

runServer();