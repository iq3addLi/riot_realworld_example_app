import "./ViewController/RootViewController.tag"
import "./ViewController/LoginViewController.tag"
import "./ViewController/ArticleViewController.tag"
import "./ViewController/EditerViewController.tag"
import "./ViewController/SettingsViewController.tag"
import "./ViewController/ProfileViewController.tag"
import "./ViewController/RegisterViewController.tag"

<application>

<script>
import ApplicationUseCase from "../Domain/UseCase/ApplicationUseCase"

var self = this
var useCase = new ApplicationUseCase()

this.on('mount', function() {
    useCase.initialize( function( error ){
        if (error != null){
            //riot.mount( "rootviewcontroller", "errorviewcontroller", { "error": error })
            //return
        }
    })
    useCase.setRoute()
    useCase.routing()
})
</script>

<div id="mainView"></div> <!-- To prevent it from being mounted automatically -->

</application>