# Projeto Ar Condicionado IoT - Time 1

## Grupo 22: Aplicação

- Ana Clara Amorim Andrade 10691992
- Lucas Yuji Matubara 10734432
- Matheus Godoy Bolsarini 9896201
- Pedro Pastorello Fernandes 10262502
- Vinıcius Eduardo de Araujo 11275193

## Sobre

Esse é o código da aplicação, ou seja, a interface do usuário com o sistema de controle do ar condicionado.

Usamos NodeJS + Express para desenvolver o back-end, que serve a pasta `/public/` e algumas rotas GET e POST para possibilitar a interação do front-end com o servidor.

Para rodar o código é necessário instalar o NodeJS.
Após isso basta rodar o comando `npm install` para instalar as dependências e `node server.js` para subir o servidor.

Na pasta `config` existem arquivos que definem configurações do servidor, da comunicação com o Broker, dos campos das mensagens e dos sensores.
Na pasta `secret` (ignorada pelo git), devem ser colocados os arquivos de credencial que o servidor irá utilizar. Isso inclui a senha do broker, certificados para autenticação com o Broker, certificados SSL para o servidor e configurações do protocolo OAuth2. Os caminhos para esses arquivos também podem ser definidos nos arquivos de configuração.

Se estiver com as configurações padrão, navegue até https://localhost:8443" para visualizar a página.


## TODO
- Fazer deploy para a VM

## Tecnologias utilizadas

### Back-end

#### Servidor
- [NodeJS](https://nodejs.org/)
- [ExpressJS](https://expressjs.com/)

#### Autenticação
- [express-session](https://www.npmjs.com/package/express-session): cookies de sessão armazenados com módulo [MemoryStore](https://www.npmjs.com/package/memorystore)
- protocolo OAuth2 (Google)

#### Biblioteca de MQTT para JavaScript (interação com o Broker)
- https://github.com/mqttjs/MQTT.js

### Front-end
- HTML
- CSS
- JavaScript
- Bootstrap

#### Ajax para comunicação com o Back-end
- https://api.jquery.com/jquery.ajax/

# Dados do time
- time_ID: 1
- Ar condicionado: 23
- Sensores de temperatura: 20, 21, 22
- Sensores de umidade: 20, 21, 22
- Sensor de luminosidade: 26
- Sensor de movimento: 25

## Broker:
- Endpoint: andromeda.lasdpc.icmc.usp.br
- Portas: 1821/8021

## VM
- ssh: <login>@andromeda.lasdpc.icmc.usp.br -p 2321
- após logar: ssh na VM tau02-vm4
- instalar na VM 4
