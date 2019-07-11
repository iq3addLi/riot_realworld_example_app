
import HTTPURLParser from "./HTTPURLParser"

/**
 * Location parser Specialized in SPA.
 */
export default class SPALocation {

    private static _instance: SPALocation

    private _application?: string
    private _paths?: string[]
    private _query?: {[key: string]: string}

    public static shared = () => {
        if ( SPALocation._instance === undefined ) {
            SPALocation._instance = new SPALocation()
        }
        SPALocation._instance.updateProperties()
        return SPALocation._instance
    }

    public application = () => { return this._application }
    public paths = () => { return this._paths }
    public query = () => { return this._query }

    constructor() {
        if (SPALocation._instance) {
            throw new Error("You must use the shared().")
        }
        SPALocation._instance = this
    }

    private updateProperties = () => {
        // Update properties
        if (location.hash === null || location.hash.length === 0 ) {
            this._application = null
            this._paths = null
            this._query = null
        } else {
            let url = HTTPURLParser.parse(location.href)
            let index = url.path.indexOf("#/")
            let str = url.path.substr( index + 2 )
            let splited = str.split("/")
            // page
            this._application = splited.shift()
            // paths
            this._paths = splited
            // query
            if ( Object.keys(url.query).length > 0 ) {
                this._query = url.query
            }
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
