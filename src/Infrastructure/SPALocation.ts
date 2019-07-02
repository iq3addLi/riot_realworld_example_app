import HTTPURL from "./HTTPURL"
import HTTPURLParser from "./HTTPURLParser"
/**
 * Location parser Specialized in SPA.
 */
export default class SPALocation {

    private static _instance: SPALocation

    private _page?: string
    private _paths?: string[]
    private _query?: {[key: string]: string}

    public static shared = () => {
        if ( SPALocation._instance === undefined ) {
            SPALocation._instance = new SPALocation()
        }
        return SPALocation._instance
    }

    public page = () => { return this._page }
    public paths = () => { return this._paths }
    public query = () => { return this._query }

    constructor() {
        if (SPALocation._instance) {
            throw new Error("must use the shared().")
        }
        SPALocation._instance = this

        // Initialize
        if (location.hash === null || location.hash.length === 0 ) { return }

        let url = HTTPURLParser.parse(location.href)
        let index = url.path.indexOf("#/")
        if ( index === -1 ) { return }
        let str = url.path.substr( index + 2 )
        let splited = str.split("/")
        // page
        this._page = splited.shift()
        // paths
        this._paths = splited
        // query
        if ( Object.keys(url.query).length > 0 ) {
            this._query = url.query
        }
    }
}


declare global {
    interface String {
        isEmpty(): boolean
    }
}

String.prototype.isEmpty = () => {
    return ( this === null || this.length === 0)
}
