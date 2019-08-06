import Settings from "../../Infrastructure/Settings"
import riot from "riot"
import route from "riot-route"

import SPALocation from "../../Infrastructure/SPALocation"

interface Menu {
    identifier: string
    filter: string
    viewControllerName: string
}

export default class ApplicationUseCase {

    private menus: Menu[] = [{
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
            viewControllerName : "articles_view_controller"
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
            viewControllerName : "articles_view_controller"
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
            riot.mount( "div#mainView", "notfound_view_controller" )
        })
        // Expected routing
        this.menus.forEach( ( menu: Menu ) => {
            route( menu.filter, () => {
                riot.mount( "div#mainView", menu.viewControllerName )
            })
        })
    }

    routing = () => {
        let loc = SPALocation.shared()
        // Decide what to mount
        let vcname: string
        if ( loc.scene() ) {
            let filterd = this.menus.filter( menu => menu.identifier === loc.scene() )
            vcname = (filterd.length > 0 ) ? filterd[0].viewControllerName : "notfound_view_controller"
        } else {
            vcname = "articles_view_controller"
        }
        setTimeout( () => {
            riot.mount( "div#mainView", vcname )
        }, 5)
    }
}
