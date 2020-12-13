const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const fs = require('fs');
const mqtt = require('mqtt');
const { google } = require('googleapis');
const path = require('path');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);

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
var acState = {}

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
    
    // VALIDAR FUNCIONAMENTO
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


function publishMessage(topic, msgStr) {
// function publishMessage(topic, payload) {
    // var msgStr = serializePayload(payload);
    // signalPublished(payload.msgId);
    // client.publish(topic, msgStr);
    
    signalPublished(msgStr);
    client.publish(topic, msgStr);

    if (brokerConfig.debugPublish) {
        serverLog(`Mensagem enviada ao topico ${topic}: ${msgStr}`);
    }
}

async function publishAcState(params) {
    serverLog(`Ac State: ${JSON.stringify(acState)}`);
    serverLog(`Nova configuracao a ser publicada: ${JSON.stringify(params)}`);

    var topic = `${brokerConfig.teamId}/aircon/${brokerConfig.acId}`;
    var payload = generateMsgPayload(params);
    
    var msgStr = serializePayload(payload);
    publishMessage(topic, msgStr);
}

async function getAcState() {    
    // serverLog('Buscando estado atual do Ar Condicionado');

    var topic = `aircon_status`;
    // var payload = {};

    publishMessage(topic, "1");

    var ok = await publishLock().then( () => {
        releaseLock();
        return true;
    }, () => {
        releaseLock();
        return false;
    });

    return ok;
}

//============
// Subscribe
//============

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

client.on('connect', function () {
    sensorsConfig.forEach(sensor => {
        subscribeToTopic(client, `${brokerConfig.roomId}/${sensor.type}/${sensor.id.toString()}`);
    })
    subscribeToTopic(client, `${brokerConfig.teamId}/response`);
    signalConnected();
})

client.on('message', function (topic, message) {
    if (brokerConfig.debugSubscribe) {
        serverLog(`Mensagem recebida no topico ${topic}: ${message.toString()}`);
    }
    
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

client.on('close', function () {
    stopServer('Conexao com o Broker perdida.');
})

client.on('offline', function () {
    stopServer('Conexao com o Broker perdida.');
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

    if (currentMsgId === -1 ) {
        acState = data;
        serverLog(`Novo estado do ar condicionado configurado: ${JSON.stringify(data)}`);
    }
    
    if (data.msgId === currentMsgId) {
        acState = data;
        serverLog(`Novo estado do ar condicionado configurado, em resposta a mensagem ${currentMsgId}: ${JSON.stringify(data)}`);
        signalReceived();
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

// Log com timestamp
function serverLog(msg) {
    console.log(`${generateTimestamp()} ${msg}`);
}

function stopServer(msg) {
    serverLog(msg);
    client.end();
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
    redirect: 'https://localhost:8443/auth',
    scopes: [
        'https://www.googleapis.com/auth/plus.me',
        'https://www.googleapis.com/auth/userinfo.email',
    ]
};
const OAuthClient = new google.auth.OAuth2(
        googleConfig.clientId,
        googleConfig.clientSecret,
        googleConfig.redirect
);

function getConnectionUrl(auth) {
    return auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: googleConfig.scopes
    });
}

function googleAuthUrl() {
    return getConnectionUrl(OAuthClient);
}

// Middlewares

app.set('trust proxy', 1);
const sessMaxAge = 86400000;
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore({
        checkPeriod: sessMaxAge
    }),
    cookie: {
        secure: true,
        maxAge: sessMaxAge
    }
}));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// auth
app.use( async (req, res, next) => {
    if (serverConfig.debugMethods.includes(req.method) && req.path !== '/sensors') {
        serverLog(`${req.protocol.toUpperCase()} Request: ${req.method} ${req.path}`);
        serverLog(`\tSessionID: ${JSON.stringify(req.sessionID)}`);
        serverLog(`\tSession: ${JSON.stringify(req.session)}`);
        serverLog(`\tQuery: ${JSON.stringify(req.query)}`);
    }

    if (req.path === '/auth') {
        next();
    } else {
        var authorized = false;
        if (req.session.tokens) {
            var {tokens} = await OAuthClient.getToken(req.session.tokens);
            
            const ticket = await OAuthClient.verifyIdToken({
                idToken: tokens.id_token,
                audience: googleConfig.clientId,
            });

            const payload = ticket.getPayload();
            serverLog(`payload: ${JSON.stringify(payload)}`);
            if (payload.hd === "usp.br") {
                authorized = true;
            }
        }
        serverLog(`\tAuthorized: ${authorized}`);

        if (authorized) {
            next();
        } else {
            if (req.path === '/') {
                res.redirect(googleAuthUrl());
            } else {
                res.sendStatus(401);
            }
        }
    }        
})

app.get('/auth', async (req, res) => {
    var code = req.query.code;
    var {tokens} = await OAuthClient.getToken(code);
    OAuthClient.setCredentials(tokens);
    req.session.tokens = tokens;
    res.redirect('/');
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
})

app.route('/state')
    .get( (req, res) => {
        res.send(acState);
    })
    .post( async (req, res) => {        
        var params = castStateParams(req.body);

        if (validStateParams(params)) {
            publishAcState(params);
            
            await publishLock().then( () => {
                releaseLock();
                res.sendStatus(200);
            }, () => {
                releaseLock();
                serverLog('Timeout na comunicacao com o Broker');
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
    
    await publishLock().then( () => {
        releaseLock();
        res.sendStatus(200);
    }, () => {
        releaseLock();
        serverLog('Timeout na comunicacao com o Broker');
        res.sendStatus(500);
    });
})

app.use( (req, res, next) => {
    res.status(404).send('Página não foi encontrada.');
});

async function runServer() {
    serverLog('Connectando ao Broker...');
    await connectedToBroker().then( () => {
        return true;
    }, () => {
        serverLog('Timeout ao se conectar ao Broker');
        return false;
    } );

    if (!client.connected) {
        stopServer('Não foi possivel se conectar ao Broker');
    } else {
        serverLog('Connectado ao Broker');
    }

    // var ok = await getAcState();
    // if (!ok) {
    //     serverLog('Timeout na comunicacao com o Broker ao buscar o estado do Ar Condicionado');
    //     stopServer('Nao foi possivel buscar o estado do Ar Condicionado');
    // } else {
    //     serverLog('Estado do Ar Condicionado configurado');
    // }

    if (serverConfig.http.enabled) {
        http.listen(serverConfig.http.port, () => {
            serverLog(`Servidor da aplicacao rodando em http://${serverConfig.hostname}:${serverConfig.http.port}`);
        })
    }
    if (serverConfig.https.enabled) {
        https.listen(serverConfig.https.port, () => {
            serverLog(`Servidor da aplicacao rodando em https://${serverConfig.hostname}:${serverConfig.https.port}`);
        })
    }
}

runServer();