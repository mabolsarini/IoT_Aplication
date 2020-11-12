const signInForm = document.getElementById("sign_in_form");
const loginButton = document.getElementById("si_submit");
const loginErrorMsg = document.getElementById("login-error-msg");

loginButton.addEventListener("click", (e) => {
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