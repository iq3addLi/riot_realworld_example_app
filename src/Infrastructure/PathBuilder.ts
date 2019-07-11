import HTTPURLParser from "./HTTPURLParser"

export default class PathBuilder {

    private top?: string
    private paths?: string[]
    private query?: {[key: string]: string}

    constructor( top?: string, paths?: string[], query?: {[key: string]: string}) {
        this.top = top
        this.paths = paths
        this.query = query
    }

    path = () => {
        return this.topString() + this.pathString() + this.keyValueStrings()
    }

    fullPath = () => {
        let url = HTTPURLParser.parse(location.href)
        let index = url.path.indexOf("#/")
        let path = index !== -1 ? "/" + url.path.substr( 0, index ) : ""
        return url.scheme + "://" + url.host + path + this.path()
    }

    private keyValueStrings = () => {
        if ( this.query == null ) { return "" }
        return "?" + Object.entries( this.query )
            .map((keyValue) => keyValue.join("=") )
            .join("&")
    }

    private pathString = () => {
        if ( this.paths == null ) { return "" }
        return "/" + this.paths.join("/")
    }

    private topString = () => {
        if ( this.top == null ) { return "" }
        return "#/" + this.top
    }
}
