import { mount, unmount, register, RiotComponentShell } from "riot"
import route from "riot-route"

import Scene from "../Model/Scene"

import Settings from "../../Infrastructure/Settings"
import SPALocation from "../../Infrastructure/SPALocation"

export default class ApplicationUseCase {

    private scenes: Scene[] = []
    private homeScene?: Scene
    private errorScene?: Scene
    private mainViewSelector!: string

    // Public
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

    /** Set the scenes. */
    setScenes = ( scenes: Scene[] ) => {
        this.scenes = scenes
    }

    /** Home scene filter is ignored */
    setHomeScene = ( scene: Scene ) => {
        this.homeScene = scene
    }

    /** RiotComponent in error scene is must accept 'message' props. */
    setErrorScene  = ( scene: Scene ) => {
        this.errorScene = scene
    }

    /** MainViewSelector is Must be set */
    setMainViewSelector = ( selector: string ) => {
        this.mainViewSelector = selector
    }

    /** Must be running before showMainView() */
    routing = () => {

        // register normal view controllers
        this.scenes.forEach( scene => register( scene.name, scene.component ) ) // memo: register() does not allow duplicate register.
        // register error view controller
        if ( this.errorScene ) { register( this.errorScene.name, this.errorScene.component ) }

        // Start routing
        route.start()

        // Routing normal
        let selector = this.mainViewSelector
        this.scenes.forEach( scene => {
            route( scene.filter, () => {
                unmount( selector, true )
                this.catchableMount( selector, scene.props, scene.name )
            })
        })
        // Routing notfound
        route( () => {
            unmount( selector, true )
            this.showError( selector, "Your order is not found.", this.errorScene )
        })
        // Routing home
        route( "/", () => {
            unmount( selector, true )
            this.catchableMount( selector, this.homeScene.props, this.homeScene.name )
        })
    }

    /** Show mainView. Please execute it after all preparations are completed. */
    showMainView = () => {

        // Decide what to mount
        const location  = SPALocation.shared()
        let scene: Scene
        // Is there an ordered scene?
        if ( location.scene() ) {
            const filterd = this.scenes.filter( scene => scene.name === location.scene() )
            if (filterd.length > 0 ) {
                scene = filterd[0]
            }
        }
        // If not, use the home scene. But home scene may not be registered
        if (scene == null) {
            scene = this.homeScene
        }
        // Have you decided which scene to show?
        if (scene) {
            this.catchableMount( this.mainViewSelector, scene.props, scene.name )
        } else {
            this.showError( this.mainViewSelector, "Your order is not found.", this.errorScene )
        }
    }

    // Private
    private catchableMount = ( selector: string, props?: object, componentName?: string) => {
        try {
            mount( selector, props, componentName )
        } catch ( error ) {
            this.showError( selector, error.message, this.errorScene )
        }
    }

    private showError = ( selector: string, message: string, errorScene?: Scene ) => {
        if (errorScene) {
            mount( selector, { message: message }, errorScene.name )
        } else {
            console.log("Failed mount view controller. error message = " + message )
        }
    }
}
