const passwordError = document.getElementById("pwd-error-msg-holder");
const signUpForm = document.getElementById("sign_up_form");
const cadastroButton = document.getElementById("su_submit");
const passwordConfirm = document.getElementById("su_pwd2");

function comparePwds(){
    const password1 = signUpForm.su_pwd1.value;
    const password2 = signUpForm.su_pwd2.value;

    if(password1 === password2) passwordError.style.display = "none";
    else passwordError.style.display = "block"; 
}

cadastroButton.addEventListener("click", (e) => {
    e.preventDefault();
    const email = signInForm.si_email.value;
    const password = signInForm.si_pwd.value;

    if (email === "user" && password === "web_dev") {
        alert("You have successfully logged in.");
        location.reload();
    } 
    else {
        loginErrorMsg.style.opacity = 1;
    }
})