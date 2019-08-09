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
import NotFoundComponent from "../../Presentation/ViewController/NotFound.riot"

interface Scene {
    name: string
    filter: string
    component: RiotComponentShell
}

export default class ApplicationUseCase {

    private scenes: Scene[] = [
        { name: "login", filter: "/login", component: LoginComponent },
        { name: "settings", filter: "/settings", component: SettingsComponent },
        { name: "articles", filter: "/articles..", component: ArticlesComponent },
        { name: "article", filter: "/article..", component: ArticleComponent },
        { name: "editer", filter: "/editer..", component: EditerComponent },
        { name: "profile", filter: "/profile..", component: ProfileComponent },
        { name: "register", filter: "/register", component: RegisterComponent },
        { name: "notfound", filter: "/notfound", component: NotFoundComponent }
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
            mount( "div#mainView", null, "notfound" )
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
                mount( "div#mainView", null, scene.name )
            })
        })
    }

    routing = () => {
        let loc = SPALocation.shared()
        // Decide what to mount
        let vcname: string
        if ( loc.scene() ) {
            let filterd = this.scenes.filter( scene => scene.name === loc.scene() )
            vcname = (filterd.length > 0 ) ? filterd[0].name : "notfound"
        } else {
            vcname = "articles"
        }
        setTimeout( () => {
            mount( "div#mainView", null, vcname )
        }, 5)
    }
}
