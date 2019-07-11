export default class HTTPURL {

    scheme: string
    host: string
    port?: number
    path?: string
    query?: { [key: string]: string}

    constructor( scheme: string, host: string, path?: string, query?: { [key: string]: string}, port?: number ) {
      this.scheme = scheme
      this.host = host
      this.path = path
      this.query = query
      this.port = port
    }

    fullPath = () => {
      return this.scheme + "://" + this.hostAndPort() + "/" + this.path + "?" + this.concatedQuery()
    }

    debugDescription = () => {
      for (let key in this) {
        let value: any = this[key]
        switch (typeof value) {
        case "object":
          console.log( key + " = " + JSON.stringify(value))
          break
        case "string":
          console.log( key + " = " + value )
          break
        }
      }
      console.log("fullPath = " + this.fullPath())
    }

    private concatedQuery = () => {
      let concated = ""
      Object.keys(this.query).forEach((key, index, keys) => {
        concated += key + "=" + this.query[key]
        if (index !== keys.length - 1) { concated += "&" }
      })
      return concated
    }

    private hostAndPort = () => {
      let hostAndPort = ""
      if ( this.port === null ) {
        return this.host
      } else {
        return this.host + ":" + this.port
      }
    }
  }
