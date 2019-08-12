import { mount, unmount, register, RiotComponent, RiotComponentShell } from "riot"
import route from "riot-route"

import Settings from "../../Infrastructure/Settings"
import SPALocation from "../../Infrastructure/SPALocation"

// Riot components
import ArticlesComponent from "../../Presentation/ViewController/Articles.riot"
import ArticleComponent from "../../Presentation/ViewController/Article.riot"
import LoginComponent from "../../Presentation/ViewController/Login.riot"
import RegisterComponent from "../../Presentation/ViewController/Register.riot"
import EditerComponent from "../../Presentation/ViewController/Editer.riot"
import ProfileComponent from "../../Presentation/ViewController/Profile.riot"
import SettingsComponent from "../../Presentation/ViewController/Settings.riot"
import ShowErrorComponent from "../../Presentation/ViewController/ShowError.riot"

interface Scene {
    name: string
    filter: string
    component: RiotComponentShell
    props?: object
}

export default class ApplicationUseCase {

    private notFoundScene: Scene = { name: "show_error", filter: "/error", component: ShowErrorComponent, props: { message: "Your order is not found." } }
    private scenes: Scene[] = [
        { name: "login", filter: "/login", component: LoginComponent },
        { name: "settings", filter: "/settings", component: SettingsComponent },
        { name: "articles", filter: "/articles..", component: ArticlesComponent },
        { name: "article", filter: "/article..", component: ArticleComponent },
        { name: "editer", filter: "/editer..", component: EditerComponent },
        { name: "profile", filter: "/profile..", component: ProfileComponent },
        { name: "register", filter: "/register", component: RegisterComponent },
        this.notFoundScene
    ]

    initialize = ( completion: (error?: Error) => void ) => {

        // Download application settings.
        let requestSettings = fetch("assets/json/settings.json")
        .then( (res) => { return res.json() })
        .then( (json) => {
            Settings.shared().set( json )
        })
        .catch(function(error) {
            throw error
        })

        // Parallel request
        Promise.all([requestSettings]).then( () => {
            document.title = Settings.shared().valueForKey("title")
            // register view controllers
            this.scenes.forEach( scene => register( scene.name, scene.component ) )
            // Success
            completion(null)
        })
        .catch((error) => {
            // Has error
            completion(error)
        })
    }

    setRoute = () => {
        route.start()
        // Not Found
        route( () => {
            unmount( "div#mainView", true)
            mount( "div#mainView", this.notFoundScene.props, this.notFoundScene.name )
        })
        // Home
        route( "/", () => {
            unmount( "div#mainView", true)
            mount( "div#mainView", null, "articles" ) // Note: The behavior when "" is assigned to name is different from v3
        })
        // Expected routing
        this.scenes.forEach( scene => {
            route( scene.filter, () => {
                unmount( "div#mainView", true)
                mount( "div#mainView", scene.props, scene.name )
            })
        })
    }

    routing = () => {
        let loc = SPALocation.shared()
        // Decide what to mount
        let sceneName = loc.scene() ? loc.scene() : "articles"
        let filterd = this.scenes.filter( scene => scene.name === sceneName )
        let scene = (filterd.length > 0 ) ? filterd[0] : this.notFoundScene

        mount( "div#mainView", scene.props, scene.name )
    }
}
