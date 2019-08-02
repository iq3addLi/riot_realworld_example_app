import Settings from "../../Infrastructure/Settings"
import riot from "riot"
import route from "riot-route"

import SPALocation from "../../Infrastructure/SPALocation"

interface Menu {
    identifier: String
    filter: String
    viewControllerName: String
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

        // 404
        route( () => {
            // Show 404 Not Found
        })

        this.menus.forEach( ( menu: Menu ) => {
            route( menu.filter, () => {
                riot.mount( "div#mainView", menu.viewControllerName, menu )
            })
        })
    }

    routing = () => {

        let loc = SPALocation.shared()

        // in launch
        if ( loc.scene() ) {
            let filterd = this.menus.filter( ( menu: Menu ) => {
                return menu.identifier === loc.scene()
            })
            if ( filterd.length > 0 ) {
                let menu = filterd[0]
                setTimeout( () => {
                    riot.mount( "div#mainView", menu.viewControllerName )
                }, 5)
            }
        } else {
            setTimeout( () => {
                riot.mount( "div#mainView", "articles_view_controller" )
            }, 5)
        }
    }
}
