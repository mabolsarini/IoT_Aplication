const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const fs = require('fs');
const mqtt = require('mqtt');
const { google } = require('googleapis');
const path = require('path');
const session = require('express-session');
const { resolve } = require('path');
const MemoryStore = require('memorystore')(session);
const crypto = require('crypto');

//=======================================================================
//
// Configuracao inicial
//
//=======================================================================

// Lendo arquivos de configuracao e credenciais
const msgFields = JSON.parse(fs.readFileSync('config/message_fields.json'));
const msgCodes = JSON.parse(fs.readFileSync('config/message_codes.json'));
const sensorsConfig = JSON.parse(fs.readFileSync('config/sensors.json'));

const serverConfig = JSON.parse(fs.readFileSync('config/server.json'));
const serverCredentials = {
    key: fs.readFileSync(serverConfig.https.cert.keyFile),
    cert: fs.readFileSync(serverConfig.https.cert.certFile),
}
const oauthCedentials = JSON.parse(fs.readFileSync(serverConfig.auth.oauthCredentialsFile));

const brokerConfig = JSON.parse(fs.readFileSync('config/broker.json'));
const brokerCredentials = {
    pass: fs.readFileSync(brokerConfig.auth.passFile).toString(),
    key: fs.readFileSync(brokerConfig.auth.keyFile).toString(),
    cert: fs.readFileSync(brokerConfig.auth.certFile).toString(),
    ca: fs.readFileSync(brokerConfig.auth.caFile).toString()
}

// Instanciando servidores
const http = require('http').createServer(app);
const https = require('https').createServer(serverCredentials, app);

// Estado - em memoria, poderia ser alguma solução de banco/cache como Redis
var acState = {}
var sensors = {
    temp: [],
    umid: [],
    movimento: [],
    luz: []
};

//=======================================================================
//
// Semaforos
//
//=======================================================================

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

//=======================================================================
//
// Configuracao da conexao com o Broker
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

client.on('connect', function () {
    sensorsConfig.forEach(sensor => {
        subscribeToTopic(client, `${brokerConfig.roomId}/${sensor.type}/${sensor.id.toString()}`);
    })
    subscribeToTopic(client, `${brokerConfig.teamId}/response`);
    signalConnected();
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
// Publish
//
//=======================================================================

function publishMessage(topic, payload) {
    var msg = serializePayload(payload);

    client.publish(topic, msg);
    signalPublished(payload.msgId);

    if (brokerConfig.debug.publish) {
        serverLog(`Mensagem publicada para o topico ${topic}: ${msg}`);
    }
}

async function publishAcState(params) {
    serverLog(`Nova configuracao a ser publicada: ${JSON.stringify(params)}`);
    
    var topic = `${brokerConfig.teamId}/aircon/${brokerConfig.acId}`;
    var payload = generateMsgPayload(params);
    
    if (payload.msgCode > 0) {
        publishMessage(topic, payload);
    } else {
        serverLog(`Configuracao igual a atual. Nada a ser feito`)
        signalPublished();
        signalReceived();
    }
}

// async function getAcState() {
//     publishMessage(`aircon_status`, {msgId: generateMessageID()});

//     await publishLock().then( () => {
//         releaseLock();
//         resolve();
//     }, () => {
//         releaseLock();
//         reject();
//     });
// }

//=======================================================================
//
// Publish: Funcoes auxiliares
//
//=======================================================================

// ID unico da mensagem
function generateMessageID() {
    var now = new Date();
    return Number(`${now.getDay()}${now.getHours()}${now.getMinutes()}${now.getSeconds()}${now.getMilliseconds()}`);
}

// Campo de codigo da mensagem
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
function generateMsgPayload(params) {
    
    // VALIDAR FUNCIONAMENTO
    var payload = {};

    Object.keys(params).forEach( key => {
        if (params[key] !== acState[key]) {
            payload[key] = params[key];
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

//=======================================================================
//
// Subscribe
//
//=======================================================================

function subscribeToTopic(client, topic) {
    client.subscribe(topic, function (err) {
        if (!err) {
            serverLog(`Inscrito no topico ${topic}`);
        } else {
            serverLog(`Erro ao se inscrever no topico ${topic}: ${err}`);
            if (msgType(topic) == 'response') {
                stopServer(`Nao foi possivel se inscrever no topico de respostas do Ar Condicionado`)
            }
        }
    })
}

client.on('message', function (topic, message) {    
    if (brokerConfig.debug.subscribe) {
        if (msgType(topic) === 'response' || !brokerConfig.debug.ignoreSensors) {
            serverLog(`Mensagem recebida no topico ${topic}: ${message.toString()}`);
        }
    }

    if (msgType(topic) === 'response') {
        processAcMsg(message);
    } else {
        processSensorMsg(topic, message);
    }
})

//=======================================================================
//
// Subscribe: Funcoes auxiliares
//
//=======================================================================

function msgType(topic) {
    return topic.split('/')[1];
}

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
    }
    
    if (data.msgId === currentMsgId) {
        acState = data;
        signalReceived();
    }

    serverLog(`Novo estado do ar condicionado configurado: ${JSON.stringify(data)}`);
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


//=======================================================================
//
// Funcoes auxiliares para o servidor
//
//=======================================================================

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

function generateTimestamp() {
    var now = new Date(); 
    return (
        "00" + (now.getMonth() + 1)).slice(-2) + "/" + (
        "00" + now.getDate()).slice(-2) + "/" + now.getFullYear() + " " + (
        "00" + now.getHours()).slice(-2) + ":" + (
        "00" + now.getMinutes()).slice(-2) + ":" + (
        "00" + now.getSeconds()).slice(-2);
}

// Log com timestamp
function serverLog(msg) {
    console.log(`${generateTimestamp()} ${msg}`);
}

function stopServer(msg) {
    serverLog(`Encerrando servidor: ${msg}`);
    client.end();
    process.exit();
}

//=======================================================================
//
// Login e autenticacao
//
//=======================================================================

const OAuthClient = new google.auth.OAuth2(
        oauthCedentials.clientId,
        oauthCedentials.clientSecret,
        oauthCedentials.redirect
);

function googleAuthUrl(client) {
    return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: oauthCedentials.scopes
    });
}

// Verifica se o token é valido pela API do OAuth, e se o dominio do email do usuario é "usp.br"
async function validateAccessTokens(tokens) {
    if (tokens === undefined) {
        reject();
    }
    var ticket = await OAuthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: oauthCedentials.clientId
    }).then( (ticket) => {
        var payload = ticket.getPayload();
        if (payload.hd === "usp.br") {
            resolve();
        } else {
            reject();
        }
    }, () => {
        reject();
    } );
}

// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Middleware de sessao
app.set('trust proxy', 1);
app.use(session({
    secret: crypto.randomBytes(20).toString("hex"),
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore({
        checkPeriod: serverConfig.auth.sessMaxAge
    }),
    cookie: {
        secure: true,
        maxAge: serverConfig.auth.sessMaxAge
    }
}));

// Middleware de autenticacao
app.use( async (req, res, next) => {
    var tokens = undefined;
    var authorized = false;

    // Tenta pegar o token da sessao, senao pega da query
    if (req.session.tokens) {
        tokens = req.session.tokens;
    } else if (req.query.code) {        
        try {
            var code = await OAuthClient.getToken(req.query.code);
            tokens = code.tokens;
            req.session.tokens = tokens;
            res.redirect('/');
            return;
        } catch (e) {
            tokens = undefined;
            authorized = false;
        }
    }

    // Valida o token
    authorized = await validateAccessTokens(tokens).then( () => {
        req.session.tokens = tokens;
        return true;
    }, () => {
        return false;
    } );

    if (serverConfig.auth.debugMethods.includes(req.method) && req.path !== '/sensors') {
        serverLog(`${req.protocol.toUpperCase()} Request: ${req.method} ${req.path}`);
        serverLog(`\tSessionID: ${JSON.stringify(req.sessionID)}`);
        serverLog(`\tAuthorized: ${authorized}`);
    }

    if (authorized) {
        next();
    } else {
        if (serverConfig.auth.redirectOnUnauthorized.includes(req.path)) {
            res.redirect(googleAuthUrl(OAuthClient));
        } else {
            res.sendStatus(401);
        }
    }
})

//=======================================================================
//
// Roteamento e definição do servidor
//
//=======================================================================

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'app.html'));
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

app.use( () => {
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

    // await getAcState().then( () => {
    //     serverLog('Estado do Ar Condicionado configurado');
    // }, () => {
    //     serverLog('Timeout na comunicacao com o Broker ao buscar o estado do Ar Condicionado');
    //     stopServer('Nao foi possivel buscar o estado do Ar Condicionado');
    // });

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