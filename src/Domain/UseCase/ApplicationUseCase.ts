// import i18next from "i18next"
// import moment from "moment"

import Settings from "../../Infrastructure/Settings"
import riot from "riot"
import route from "riot-route"
// import parse from "url-parse" // don't parse query :(

import SPALocation from "../../Infrastructure/SPALocation"
// import Analytics from "../../Infrastructure/Analytics"

// import "../../Presentation/ViewController/RootViewController.tag"
// import "../../Presentation/ViewController/LoginViewController.tag"
// import "../../Presentation/ViewController/SettingsViewController.tag"


interface Menu {
    identifier: String
    viewControllerName: String
}

export default class ApplicationUseCase {

    private menus: Menu[] = [{
            identifier : "",
            viewControllerName : "articles_view_controller"
        }, {
            identifier : "login",
            viewControllerName : "login_view_controller"
        }, {
            identifier : "settings",
            viewControllerName : "settings_view_controller"
        }, {
            identifier : "article",
            viewControllerName : "article_view_controller"
        }, {
            identifier : "editer",
            viewControllerName : "editer_view_controller"
        }, {
            identifier : "profile",
            viewControllerName : "profile_view_controller"
        }, {
            identifier : "register",
            viewControllerName : "register_view_controller"
        }, {
            identifier : "articles",
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

        // // Download loacalize strings.
        // let lang = ((window.navigator.languages && window.navigator.languages[0]) ||
        //              window.navigator.language).substr(0, 2) === "ja" ? "ja" : "en"
        // let requestLocalizedString = fetch("assets/json/i18n/" + lang + "/localize.json")
        // .then( (res) => { return res.json() })
        // .then( (json) => {
        //     let resources = {}
        //     resources[lang] = { translation: json }
        //     i18next.init({
        //         lng: lang,
        //         debug: false,
        //         resources: resources,
        //         interpolation: {
        //             format: function(value, format, lng) {
        //                 if (format === "uppercase") { return value.toUpperCase() }
        //                 if (value instanceof Date) { return moment(value).format(format) }
        //                 return value
        //             }
        //         }
        //     }, function( error, translation ) {
        //         throw error
        //     })
        // })
        // .catch((error) => {
        //     throw error
        // })

        // // Request of parallel.
        Promise.all([requestSettings/*, requestLocalizedString*/])
        .then( () => {
            // Start Analytics
            // Analytics.shared().start( Settings.shared().valueForKey("analytics").trackingID )
            // Analytics.shared().send("pageview")
            // No error
            // Set Title
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
            route( "/" + menu.identifier + "..", () => {
                console.log("route is " + menu.identifier )
                riot.mount( "div#mainView", menu.viewControllerName, menu )
            })
        })
    }


    routing = () => {

        let loc = SPALocation.shared()
        console.log( loc )

        // in launch
        if ( loc.application() ) {
            let filterd = this.menus.filter( ( menu: Menu ) => {
                return menu.identifier === loc.application()
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
