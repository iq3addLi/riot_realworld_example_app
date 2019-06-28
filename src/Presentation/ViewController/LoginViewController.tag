import "../View/HeaderView.tag"
import "../View/FooterView.tag"

<login_view_controller>

<script>
import LoginUseCase from "../../Domain/UseCase/LoginUseCase"

var self = this
var useCase = new LoginUseCase()
self.errorMessage = null

self.actionOfLoginButton = ( event ) => {
    useCase.login( self.refs.emailField.value, self.refs.passwordField.value ).then( () => {
        // success
        window.location.href = '/'
    }).catch( (error) => {
        // fail
        self.errorMessage = "email or password is invalid"
        self.update()
    })
}

self.shouldSubmit = ( event ) => {
    self.refs.submitButton.disabled = ( self.refs.emailField.value.length == 0 || self.refs.passwordField.value.length == 0 )
}

</script>

<header_view />

<div class="auth-page">
    <div class="container page">
        <div class="row">
    
        <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">Sign In</h1>
            <p class="text-xs-center">
            <a href="#/register">Need an account?</a>
            </p>
    

            <ul if={ errorMessage != null } class="error-messages">
                <li>{ errorMessage }</li>
            </ul>
    
            <fieldset class="form-group">
                <input ref="emailField" class="form-control form-control-lg" type="text" placeholder="Email" oninput={ shouldSubmit }>
            </fieldset>
            <fieldset class="form-group">
                <input ref="passwordField" class="form-control form-control-lg" type="password" placeholder="Password" oninput={ shouldSubmit }>
            </fieldset>
            <button ref="submitButton" class="btn btn-lg btn-primary pull-xs-right" onclick={ actionOfLoginButton } disabled>
                Sign in
            </button>
        </div>
    
        </div>
    </div>
</div>

<footer_view />

</login_view_controller>