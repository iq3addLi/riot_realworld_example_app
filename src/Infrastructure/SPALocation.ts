import HTTPURLParser from "./HTTPURLParser"

/**
 * Location parser in Hash Based Url
 */
export default class SPALocation {

    public static shared = () => {
        if ( SPALocation._instance === undefined ) {
            SPALocation._instance = new SPALocation()
        }
        SPALocation._instance.updateProperties()
        return SPALocation._instance
    }

    private static _instance: SPALocation

    private _scene?: string = null
    private _paths?: string[] = null
    private _query?: {[key: string]: string} = null

    constructor() {
        if (SPALocation._instance) {
            throw new Error("You must use the shared().")
        }
        SPALocation._instance = this
    }

    public scene = () => { return this._scene }
    public paths = () => { return this._paths }
    public query = () => { return this._query }

    private updateProperties = () => {
        try {
            if (location.hash === null || location.hash.length === 0 ) {
                throw Error("location is empty.")
            }
            const url = new HTTPURLParser().parse(location.href)
            const path = url.path
            if ( path === null ) {
                throw Error("A path is empty.")
            }
            const index = path.indexOf("#/")
            if ( index === -1 ) {
                throw Error("hashbang is not found.")
            }
            const str = path.substr( index + 2 ).replace(/\/$/, "")
            const splited = str.split("/")
            if ( splited.length < 1 ) {
                throw Error("A path is not splittable.")
            }
            this._scene = splited.shift()
            this._paths = splited.length > 0 ? splited : null
            this._query = url.query

        } catch (error) {
            this._scene = null
            this._paths = null
            this._query = null
        }
    }
}
