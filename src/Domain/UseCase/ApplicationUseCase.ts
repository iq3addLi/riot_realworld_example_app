import { mount, register } from "riot"
import route from "riot-route"

import Settings from "../../Infrastructure/Settings"
import SPALocation from "../../Infrastructure/SPALocation"

// Riot components
import Articles from "../../Presentation/ViewController/Articles.riot"

interface Scene {
    identifier: string
    filter: string
    viewControllerName: string
}

export default class ApplicationUseCase {

    private scenes: Scene[] = [{
            identifier : "login",
            filter : "/login",
            viewControllerName : "login_view_controller"
        }, {
            identifier: "settings",
            filter : "/settings",
            viewControllerName : "settings_view_controller"
        }, {
            identifier : "articles",
            filter : "/articles..",
            viewControllerName : "articles"
        }, {
            identifier : "article",
            filter : "/article..",
            viewControllerName : "article_view_controller"
        }, {
            identifier : "editer",
            filter : "/editer..",
            viewControllerName : "editer_view_controller"
        }, {
            identifier : "profile",
            filter : "/profile..",
            viewControllerName : "profile_view_controller"
        }, {
            identifier : "register",
            filter : "/register",
            viewControllerName : "register_view_controller"
        }, {
            identifier : "",
            filter : "/",
            viewControllerName : "articles"
        }
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
        Promise.all([requestSettings])
        .then( () => {
            // set title
            document.title = Settings.shared().valueForKey("title")

            // register view controllers
            register("articles", Articles)

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
            mount( "div#mainView", null, "notfound_view_controller" )
        })
        // Expected routing
        this.scenes.forEach( scene => {
            route( scene.filter, () => {
                mount( "div#mainView", null, scene.viewControllerName )
            })
        })
    }

    routing = () => {
        let loc = SPALocation.shared()
        // Decide what to mount
        let vcname: string
        if ( loc.scene() ) {
            let filterd = this.scenes.filter( scene => scene.identifier === loc.scene() )
            vcname = (filterd.length > 0 ) ? filterd[0].viewControllerName : "notfound_view_controller"
        } else {
            vcname = "articles"
        }
        setTimeout( () => {
            mount( "div#mainView", null, vcname )
        }, 5)
    }
}
