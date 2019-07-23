import "../View/HeaderView.tag"
import "../View/FooterView.tag"

<settings_view_controller>

<script>
import SettingsUseCase from "../../Domain/UseCase/SettingsUseCase"

var self = this
var useCase = new SettingsUseCase()

this.on('mount', () => {
    if ( useCase.isLoggedIn() == true ) {
        self.tags.header_view.setUser( useCase.loggedUser() )
    }
})

self.actionOfUpdateButton = () => {
    console.log("Update")
}
</script>

<header_view />

    <div class="settings-page">
        <div class="container page">
            <div class="row">
        
            <div class="col-md-6 offset-md-3 col-xs-12">
                <h1 class="text-xs-center">Your Settings</h1>
        
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
            </div>
        
            </div>
        </div>
    </div>

<footer_view />

</settings_view_controller>