export default class HTTPURL {

    scheme: string
    host: string
    path: string
    query: { [key: string]: string}

    constructor( scheme: string, host: string, path: string, query: { [key: string]: string}  ) {
      this.scheme = scheme
      this.host = host
      this.path = path
      this.query = query
    }

    fullPath = () => {
      return this.scheme + "://" + this.host + "/" + this.path + "?" + this.concatedQuery()
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
  }
