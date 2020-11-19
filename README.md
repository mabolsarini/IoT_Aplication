# Projeto Ar Condicionado IoT - Time 1

## Grupo 1: Aplicação

- Ana Clara Amorim Andrade 10691992
- Lucas Yuji Matubara 10734432
- Matheus Godoy Bolsarini 9896201
- Pedro Pastorello Fernandes 10262502
- Vinıcius Eduardo de Araujo 11275193

## Sobre

Esse é o código da aplicação, ou seja, a interface do usuário com o sistema de controle do ar condicionado.

Usamos NodeJS + Express para desenvolver o back-end, que serve a pasta `/public/` e algumas rotas GET e POST para possibilitar a interação do front-end com o servidor.

Para rodar o código é necessário instalar o NodeJS.
Após isso basta rodar o comando `npm install` para instalar as dependências e `node index.js` para subir o servidor.

As configurações de endereço e porta do servidor e da conexão com o broker podem ser feitas na variável `config`, no começo arquivo que define o servidor (`index.js`). No futuro, iremos transformar essa configuração em um arquivo, desacoplado do código.

Se estiver com as configuraçõe padrão, navegue até http://localhost:8080" para visualizar a página.

O que ainda será feito para o checkpoint 3:
- Funções de interação com o Broker (prioridade)
- Retirar mocks e integrar a interação com o broker no lugar deles (prioridade)
- Adicionar um sistema ou proxy de login, provelmente a tela de login da google (prioridade)
- Servir o site usando https
- Subir o servidor em alguma máquina ou provedor de Núvem para disponibilizar a aplicação na internet

!! Por favor, leia os comentários feitos no arquivo `index.js` !!

## Tecnologias utilizadas

### Back-end

#### NodeJS + Express (Servidor)
- https://nodejs.org/
- https://expressjs.com/
- https://developer.mozilla.org/pt-BR/docs/Learn/Server-side/Express_Nodejs/Introdu%C3%A7%C3%A3o

#### Biblioteca de MQTT para JavaScript (interação com o Broker)
- https://github.com/mqttjs/MQTT.js

### Front-end

- HTML
- CSS
- JavaScript

#### Ajax para atualização dinâmica da página
- https://api.jquery.com/jquery.ajax/

# Dados do time

- time_ID: 1
- Ar condicionado: 23
- Sensores de temperatura: 20, 21, 22
- Sensores de umidade: 20, 21, 22
- Sensor de luminosidade: 26
- Sensor de movimento: 25

# Broker:
- Endpoint: andromeda.lasdpc.icmc.usp.br
- Portas: 1821/8021