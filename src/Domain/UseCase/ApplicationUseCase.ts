import { mount, unmount, register, RiotComponentShell } from "riot"
import route from "riot-route"

import Scene from "../Model/Scene"

import Settings from "../../Infrastructure/Settings"
import SPALocation from "../../Infrastructure/SPALocation"

export default class ApplicationUseCase {

    private scenes: Scene[] = []
    private homeScene?: Scene
    private notFoundScene?: Scene
    private mainViewSelector!: string

    initialize = ( completion: (error?: Error) => void ) => {

        // Download application settings.
        const requestSettings = fetch("assets/json/settings.json")
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
            // Success
            completion(null)
        })
        .catch((error) => {
            // Has error
            completion(error)
        })

    }

    setScenes = ( scenes: Scene[] ) => {
        this.scenes = scenes
    }

    setHome = ( name: string, component: RiotComponentShell ) => {
        this.homeScene = { name: name, component: component, filter: "/" }
    }

    setNotFoundScene = ( scene: Scene ) => {
        this.notFoundScene = scene
    }

    setMainViewSelector = ( selector: string ) => {
        this.mainViewSelector = selector
    }

    routing = () => {

        // register view controllers
        this.scenes.forEach( scene => register( scene.name, scene.component ) ) // register() does not allow duplicate register.

        // Setup routing
        route.start()
        this.scenes.forEach( scene => this.setRoute( this.mainViewSelector, scene ) )
        this.setRoute( this.mainViewSelector, this.homeScene )
    }

    showMainView = () => {

        // Decide what to mount
        let loc = SPALocation.shared()
        let sceneName = loc.scene() ? loc.scene() : "articles"
        let filterd = this.scenes.filter( scene => scene.name === sceneName )
        let scene = (filterd.length > 0 ) ? filterd[0] : this.notFoundScene

        mount( this.mainViewSelector, scene.props, scene.name )
    }

    private setRoute = ( selector: string, scene: Scene ) => {

        if ( scene.filter != null ) {
            route( scene.filter, () => {
                unmount( selector, true)
                mount( selector, scene.props, scene.name )
            })
        } else {
            route( () => {
                unmount( selector, true)
                mount( selector, scene.props, scene.name )
            })
        }
    }
}
