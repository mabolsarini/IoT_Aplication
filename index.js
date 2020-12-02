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
    power: true,
    powerOnIdle: true,
    tMin: 16,
    tMax: 18,
    tOp: 17,
    delay: 10,
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
}; var client  = mqtt.connect(options);

//==========
// Publish
//==========

// // Função que irá gerar o ID da mensagem para envia-la ao broker
// // Não ficou claro qual é a heurística para fazer isso, então a função ainda não foi implementada
// function generateMessageId() {
//     return 12345;
// }

// // Função que retorna um objeto de estado apenas com os campos diferentes entre dois estados
// // Usada por getMsgCode()
// function stateDiff(stateA, stateB) {
//     // Implementar
// }

// // Função para gerar o código para identificação de campos contidos numa mensagem a ser enviada
// // Toda vez que o usuário aplicar uma nova configuração pelo site, recebemos um objeto de estado inteiro do front-end.
// // Portanto, precisamos fazer um diff entre o estado pedido pelo usuário e o estado atual do ar condicionado
// // Para isso, precisaremos pegar última mensagem de estado vinda do ar condicionado e compará-la com o estado recebido do front-end
// // Isso depende da troca de mensagens ter sido implementada.
// function getMsgCode(newState, lastState) {
//     // Comparar o estado atual do ar-condicionado com o estado solicitado pelo usuário
//     // lastState é última mensagem de estado recebida
//     var diff = stateDiff(newState, lastState);
    
//     var msgCodes = {
//         tMax: 4,
//         tMin: 8,
//         delay: 26,
//         tOp: 32,
//         power: 1,
//         powerOnIdle: 2
//     }

//     // Somar os valores
    
//     return 0;
// }

// // Função para gerar o conteúdo em JSON de uma mensagem que representa uma solicitação de mudança de estado
// function serializeStateData(state) {
//     return JSON.stringify({
//         "0": getMsgCode(state),
//         "1": state.tMax,
//         "2": state.tMIn,
//         "3": state.delay,
//         "4": state.tOp,
//         "21": state.power ? 1 : 0,
//         "22": state.powerOnIdle ? 1 : 0,
//         "23": generateMessageId()
//     });
// }

// function parseStateResponseData(stringData) {
//     data = JSON.parse(stringData);

//     return {
//         tMax: data['1'],
//         tMin: data['2'],
//         delay: data['3'],
//         tOp: data['4'],
//         power: (data['21'] === 1),
//         powerOnIdle: (data['22'] === 1),
//         msgId: data['23'],
//         lastUpdate: parseTimestamp(data['s']),
//     }
// }

//==========
// Subscribe / sensores
//==========

function subscribeToSensor(client, sensorType, sensorId) {
    var topic = brokerConfig.roomId+"/"+sensorType+"/"+sensorId.toString();
    
    client.subscribe(topic, function (err) {
        if (!err) {
          console.log('Inscrito no topico '+topic)
        } else {
          console.log('Erro ao se inscrever no topico '+topic+': '+err);
        }
    })
}

client.on('connect', function () {
    subscribeToSensor(client, "temp", 20);
    subscribeToSensor(client, "temp", 21);
    subscribeToSensor(client, "temp", 22);
    subscribeToSensor(client, "umid", 20);
    subscribeToSensor(client, "umid", 21);
    subscribeToSensor(client, "umid", 22);
    subscribeToSensor(client, "movimento", 25);
    subscribeToSensor(client, "luz", 26);
})

client.on('message', function (topic, message) {
    var rawData = message.toString();
    var sensorType = topic.split('/')[1];
    var sensorId = topic.split('/')[2];

    data = parseSensorData(sensorType, rawData);

    var index = sensors[sensorType].findIndex(s => s.name === data.name);
    if (index === -1) {
        sensors[sensorType].push(data);
    } else {
        sensors[sensorType][index] = data;
    }
    
    console.log(JSON.stringify(data));
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
        value: v,
        time: parseTimestamp(data['s'])
    };
}

// Funções para trabalhar com as timestamps no formato definido
function parseTimestamp(tsString) {
    var pattern = /(\d{2})\/(\d{2})\/(\d{4})\ (\d{2}):(\d{2}):(\d{2})/
    return new Date(tsString.replace(pattern,'$3-$2-$1T$4:$5:$6'));
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

function switchAcPower(state) {
    state.power = !state.power;
    return state;
}

// Log de uma alteração de estado com uma mensagem e timestamp
function logState(msg) {
    console.log(generateTimestamp()+" "+msg+": "+JSON.stringify(acState));
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
            setAcState(acState, params);

            logState("Nova configuracao de estado recebida");
            res.status(200);
        } else {
            logState("Configuracao de estado invalida recebida");
            res.sendStatus(400);
        }
    })
;

app.get('/sensors', (req, res) => {
    res.send(sensors);
})
    
app.post('/power', (req, res) => {
    acState = switchAcPower(acState);

    logState("Nova configuracao de estado recebida");
    res.status(200);
})

app.use(function(req, res, next) {
    res.status(404).send('Página não foi encontrada.');
});

http.listen(serverConfig.port, () => {
  console.log(`Servidor da aplicacao rodando em http://localhost:${serverConfig.port}`)
})