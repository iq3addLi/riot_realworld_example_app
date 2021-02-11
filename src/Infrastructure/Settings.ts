/**
 * Application Settings Container
 */
export default class Settings {

    public static shared = () => {
        if ( Settings._instance === undefined ) {
            Settings._instance = new Settings()
        }
        return Settings._instance
    }

    private static _instance: Settings

    private settings: Object
    constructor() {
        if (Settings._instance) {
            throw new Error("must use the shared().")
        }
        Settings._instance = this
    }
    public set = ( settings: Object ) => {
        this.settings = settings
    }
    public valueForKey = ( key: string ) => {
        if ( this.settings == null ) {
            throw new Error("Must be set.")
        }
        return this.settings[key]
    }
}
