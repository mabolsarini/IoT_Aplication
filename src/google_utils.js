import { google } from 'googleapis';

const googleConfig = {
    clientId: '533599554971-r4v411ohc19409aqkobbn98a05n90tes.apps.googleusercontent.com',
    clientSecret: 'xFuynIbrURArdAB6TZB4l8Zt',
    redirect: 'https://localhost:8443/auth'
};

function createConnection() {
    return new google.auth.OAuth2(
        googleConfig.clientId,
        googleConfig.clientSecret,
        googleConfig.redirect
    );
}

const defaultScope = [
    'https://www.googleapis.com/auth/plus.me',
    'https://www.googleapis.com/auth/userinfo.email',
];

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