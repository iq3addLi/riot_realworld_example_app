import HTTPURL from "./HTTPURL"

interface HostAndPort {
    host: string,
    port?: number
}

/// Easliy HTTP(S) URL Parser for SPA. ftp, ssh, git and other is not supported ;)
export default class HTTPURLParser {

    parse = ( urlString: string ): HTTPURL|null =>  {
        try {
            let scheme = this.parsedScheme(urlString)
            let host = this.parsedHost(urlString)
            let port = this.parsedPort(urlString)
            let path = this.parsedPath(urlString)
            let query = this.parsedQuery(urlString)
            if ( scheme == null || host == null || Number.isNaN(port) || (path === null && query !== null) ) {
                throw Error("Argument is not HTTPURL.")
            }
            // Success
            return new HTTPURL( scheme, host, path, query, port )
        } catch (error) {
            if ( error instanceof Error) {
                console.log( error.message )
            }
            // Failure
            return null
        }
    }

    private parsedScheme = (urlString: string) => {
        // scheme
        const slasher = "://"
        let index = urlString.indexOf(slasher)
        if (index === -1) {
            return null // not url
        }
        return urlString.substr(0, index)
    }

    private parsedHost = (urlString: string) => {
        return this.splitHostAndPort(this.parsedHostAndPort(urlString)).host
    }

    private parsedPort = (urlString: string) => {
        return this.splitHostAndPort(this.parsedHostAndPort(urlString)).port
    }

    private parsedPath = (urlString: string) => {
        const slasher = "://"
        let index = urlString.indexOf(slasher)
        if (index === -1) {
            return null // not url
        }
        let indexS = urlString.indexOf("/", index + slasher.length)
        if (indexS === -1) {
            return null // path is not found
        }
        // "?" terminate
        let indexQ = urlString.indexOf("?", indexS)
        if (indexQ !== -1) {
            let path = urlString.substr(indexS + 1, indexQ - indexS - 1)
            return path.length === 0 ? null : path
        }
        // path only
        let path = urlString.substr(indexS + 1)
        return path.length === 0 ? null : path
    }

    private parsedQuery = (urlString: string) => {
        // query
        let indexQ = urlString.indexOf("?")
        let query: { [key: string]: string} = {}
        if (indexQ === -1) {
            return null // query not found
        }
        if (urlString.split("?").length !== 2) {
            throw Error("Unexpected query.")
        }
        let queryString = urlString.split("?")[1]
        let keyValues = queryString.split("&")
        for (let i in keyValues) {
            let keyValue = keyValues[i]
            let arr = keyValue.split("=")
            if (arr.length !== 2) {
                throw Error("A query has unexpected key-value.")
            }
            query[arr[0]] = arr[1]
        }
        return query
    }

    private parsedHostAndPort = (urlString: string) => {
        // host
        const slasher = "://"
        let index = urlString.indexOf(slasher)
        let afterScheme = urlString.substr(index + slasher.length)

        // "/" terminate
        let indexS = afterScheme.indexOf("/")
        if (indexS !== -1) {
            return afterScheme.substr(0, indexS)
        }
        // "?" terminate
        let indexQ = afterScheme.indexOf("?")
        if (indexQ !== -1) {
            return afterScheme.substr(0, indexQ)
        }
        // host only
        return afterScheme
    }


    private splitHostAndPort = (hostWithPort: string): HostAndPort => {

      // port
      let indexC = hostWithPort.indexOf(":")
      if ( indexC !== -1 ) {
        let splitted = hostWithPort.split(":")
        if (splitted.length === 2) {
            return { host: splitted[0], port: Number(splitted[1]) }
        }
        throw Error("A host has multiple colon.")
      }
      return { host: hostWithPort, port: null }
    }
  }

