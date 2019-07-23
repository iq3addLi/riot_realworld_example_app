
import HTTPURLParser from "./HTTPURLParser"

/**
 * Location parser Specialized in SPA.
 */
export default class SPALocation {

    private static _instance: SPALocation

    private _scene?: string
    private _paths?: string[]
    private _query?: {[key: string]: string}

    public static shared = () => {
        if ( SPALocation._instance === undefined ) {
            SPALocation._instance = new SPALocation()
        }
        SPALocation._instance.updateProperties()
        return SPALocation._instance
    }

    public scene = () => { return this._scene }
    public paths = () => { return this._paths }
    public query = () => { return this._query }

    constructor() {
        if (SPALocation._instance) {
            throw new Error("You must use the shared().")
        }
        SPALocation._instance = this
    }

    private updateProperties = () => {
        try {
            if (location.hash === null || location.hash.length === 0 ) {
                throw Error("location is empty.")
            }
            let url = new HTTPURLParser().parse(location.href)
            let path = url.path
            if ( path === null ) {
                throw Error("A path is empty.")
            }
            let index = path.indexOf("#/")
            if ( index === -1 ) {
                throw Error("hashbang is not found.")
            }
            let str = path.substr( index + 2 )
            let splited = str.split("/")
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


// declare global {
//     interface String {
//         isEmpty(): boolean
//     }
// }

// String.prototype.isEmpty = () => {
//     return ( this === null || this.length === 0)
// }
