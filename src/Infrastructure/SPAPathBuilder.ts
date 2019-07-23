import HTTPURLParser from "./HTTPURLParser"

export default class SPAPathBuilder {

    private scene?: string
    private paths?: string[]
    private query?: {[key: string]: string}

    constructor( scene?: string, paths?: string[], query?: {[key: string]: string}) {
        this.scene = scene
        this.paths = paths
        this.query = query
    }

    path = () => {
        return this.sceneString() + this.pathString() + this.keyValueStrings()
    }

    fullPath = () => {
        let url = new HTTPURLParser().parse(location.href)
        return url.scheme + "://" + this.hostAndPort(url.host, url.port) + (this.path() === "" ? "" : "/" + this.path())
    }

    private hostAndPort = (host: string, port?: number) => {
        if (port == null || port === 0) {
            return host
        } else {
            return host + ":" + port
        }
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

    private sceneString = () => {
        if ( this.scene == null ) { return "" }
        return "#/" + this.scene
    }
}
