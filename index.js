const express = require('express');
const bodyParser = require("body-parser");
const mqtt = require('mqtt');
const app = express();
const http = require('http').createServer(app);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

const config = {
    hostname: '127.0.0.1',
    port: 8080,
    brokerEndpoint: 'andromedalasdpc.icmc.usp.br',
    borkerPort: 8021,
    teamId: '1',
    roomId: '2',
    acId: '23'
}

//=======================================================================
//
// MOCKS. Serão removidos para o checkpoint 3
//
//=======================================================================

// Mock do estado ar condicionado com os valores padrão
// A ideia é que, quando as funções de troca de mensagens estiverem implementadas,
// iremos manter esse estado atualizado, de acordo com a última mensagem de resposta
// de estado recebida do Broker
var acState = {
    power: true,
    powerOnIdle: true,
    tMin: 16,
    tMax: 18,
    tOp: 17,
    delay: 10,
}

// Mock dos sensores com valores estabelecidos
// Da mesma forma que o estado do ar condicionado, esses valores serão constantemente
// atualizados de acordo com as mensagens recebidas do broker 
var sensors = [
    {name: "20", type: "temp", value: "20.0"},
    {name: "21", type: "temp", value: "21.0"},
    {name: "22", type: "temp", value: "22.0"},
    {name: "20", type: "umid", value: "20.1"},
    {name: "21", type: "umid", value: "21.1"},
    {name: "22", type: "umid", value: "22.1"},
    {name: "26", type: "luz", value: "26.0"},
    {name: "25", type: "movimento", value: "0"}
];

//=======================================================================
//
// Interação com o Boker MQTT - Será desenvolvida para o checkpoint 3
// https://github.com/mqttjs/MQTT.js
//
//=======================================================================

// Instancionado a conexão com o broker
const broker = mqtt.connect('mqtt://'+config.brokerEndpoint);

// Função para ler uma nova mensagem de estado do broker
// Isso provavelmente será uma subrotina assícrona
function getNewState() {
    var topic = config.teamId+'/response';

    // Fazer subscribe no tópico, etc
}

// Função para publicar uma nova mensagem de estado para o broker
function publishNewState(newState) {
    var topic = config.teamId+'/aircon'+config.acId;

    acState = getNewState();

    // Publicar mensagem no tópico, etc
}

// Função para ler constantemente novas mensagens de dados dos sensores
// Isso provavelmente será uma subrotina assícrona
function getSensorData(sensorType, sensorId) {
    var topic = config.roomId+'/'+sensorType+'/'+sensorId;

    // Fazer subscribe no tópico, etc
}

// Função que irá gerar o ID da mensagem para envia-la ao broker
// Não ficou claro qual é a heurística para fazer isso, então a função ainda não foi implementada
function generateMessageId() {
    return 12345;
}

// Função que retorna um objeto de estado apenas com os campos diferentes entre dois estados
// Usada por getMsgCode()
function stateDiff(stateA, stateB) {
    // Implementar
}

// Função para gerar o código para identificação de campos contidos numa mensagem a ser enviada
// Toda vez que o usuário aplicar uma nova configuração pelo site, recebemos um objeto de estado inteiro do front-end.
// Portanto, precisamos fazer um diff entre o estado pedido pelo usuário e o estado atual do ar condicionado
// Para isso, precisaremos pegar última mensagem de estado vinda do ar condicionado e compará-la com o estado recebido do front-end
// Isso depende da troca de mensagens ter sido implementada.
function getMsgCode(newState, lastState) {
    // Comparar o estado atual do ar-condicionado com o estado solicitado pelo usuário
    // lastState é última mensagem de estado recebida
    var diff = stateDiff(newState, lastState);
    
    var msgCodes = {
        tMax: 4,
        tMin: 8,
        delay: 26,
        tOp: 32,
        power: 1,
        powerOnIdle: 2
    }

    // Somar os valores
    
    return 0;
}

// Função para gerar o conteúdo em JSON de uma mensagem que representa uma solicitação de mudança de estado
function serializeStateData(state) {
    return JSON.stringify({
        "0": getMsgCode(state),
        "1": state.tMax,
        "2": state.tMIn,
        "3": state.delay,
        "4": state.tOp,
        "21": state.power ? 1 : 0,
        "22": state.powerOnIdle ? 1 : 0,
        "23": generateMessageId()
    });
}

function parseStateResponseData(stringData) {
    data = JSON.parse(stringData);

    return {
        tMax: data['1'],
        tMin: data['2'],
        delay: data['3'],
        tOp: data['4'],
        power: (data['21'] === 1),
        powerOnIdle: (data['22'] === 1),
        msgId: data['23'],
        lastUpdate: parseTimestamp(data['s']),
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
        value: v,
        time: parseTimestamp(data['s'])
    };
}

//=======================================================================
//
// Funções auxiliares para o servidor
//
//=======================================================================

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

app.route('/state')
    .get((req, res) => {
        res.send(acState);
    })
    .post((req, res) => {        
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

app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Houve um problema interno no servidor.');
});

http.listen(config.port, () => {
  console.log(`Servidor da aplicacao rodando em http://localhost:${config.port}`)
})