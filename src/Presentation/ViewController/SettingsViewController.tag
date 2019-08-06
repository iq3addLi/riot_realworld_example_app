import "../View/HeaderView.tag"
import "../View/FooterView.tag"

<settings_view_controller>

<script>
import SettingsUseCase from "../../Domain/UseCase/SettingsUseCase"

var self = this
var useCase = new SettingsUseCase()

self.errors = null

this.on("mount", () => {

    if( useCase.isLoggedIn() === false ){
        useCase.jumpToNotFound()
        return
    }
    // setup header
    self.tags.header_view.setItems( useCase.menuItems() )

    // setup form
    let user = useCase.loggedUser()
    self.refs.iconURLField.value = user.image
    self.refs.nameField.value = user.username
    self.refs.bioField.value = user.bio
    self.refs.emailField.value = user.email
})

self.actionOfUpdateButton = () => {
    let email = this.refs.emailField.value
    let username = this.refs.nameField.value
    let bio = this.refs.bioField.value
    let image = this.refs.iconURLField.value
    let password = this.refs.passwordField.value

    useCase.post(email, username, bio, image, password).then( (user) => {
        // success
        useCase.jumpToHome()
    }).catch( (error) => {
        // failure
        if (error instanceof Array ) {
            self.errors = error.map( (aError) => aError.message )
        }else if( error instanceof Error ) {
            self.errors = [ error.message ]
        }
        self.update()
    })
}

self.actionOfLogoutButton = () => {
    useCase.logoutAfterJumpToHome()
}

</script>

<header_view />

    <div class="settings-page">
        <div class="container page">
            <div class="row">
        
            <div class="col-md-6 offset-md-3 col-xs-12">
                <h1 class="text-xs-center">Your Settings</h1>
        

                <ul if={ errors != null } class="error-messages">
                    <li each={ error in errors }>{ error }</li>
                </ul>

                <form>
                <fieldset>
                    <fieldset class="form-group">
                        <input ref="iconURLField" class="form-control" type="text" placeholder="URL of profile picture">
                    </fieldset>
                    <fieldset class="form-group">
                        <input ref="nameField" class="form-control form-control-lg" type="text" placeholder="Your Name">
                    </fieldset>
                    <fieldset class="form-group">
                        <textarea ref="bioField" class="form-control form-control-lg" rows="8" placeholder="Short bio about you"></textarea>
                    </fieldset>
                    <fieldset class="form-group">
                        <input ref="emailField" class="form-control form-control-lg" type="text" placeholder="Email">
                    </fieldset>
                    <fieldset class="form-group">
                        <input ref="passwordField" class="form-control form-control-lg" type="password" placeholder="Password">
                    </fieldset>
                    <button class="btn btn-lg btn-primary pull-xs-right" type="button" onclick={ actionOfUpdateButton }>
                        Update Settings
                    </button>
                </fieldset>
                </form>

                <hr>
                <button class="btn btn-outline-danger" onclick={ actionOfLogoutButton }> Or click here to logout. </button>
            </div>
        
            </div>
        </div>
    </div>

<footer_view />

</settings_view_controller>
