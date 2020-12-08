
function onSignIn(googleUser){
    console.log("SignIn Ok");
    $.post('/login',googleUser.getAuthResponse().id_token,params=>{
        if(!params){
            gapi.auth2.getAuthInstance().signOut().then(function(){
                console.log('user signed out');
            });
        }
        mainButton.disabled = !params;
    });        
}
function SignOut(){
    $.post('/singout');
    window.location.href = '/login';
}
function toMain(){
    $.get('/main');
    window.location.href = "/main";
}