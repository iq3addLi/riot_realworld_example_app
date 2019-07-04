import HTTPURL from "./HTTPURL"

/// Easliy HTTP(S) URL Parser for SPA. ftp, ssh, git and other is not supported. port unsupported ;)
export default class HTTPURLParser {

    static parse = ( urlString: string ) => {
      // scheme
      const slasher = "://"
      let index = urlString.indexOf(slasher)
      if (index === -1) { return null }
      let scheme = urlString.substr(0, index)

      // host
      const separator = "/"
      let hostAtLater = urlString.substr(index + slasher.length)
      let host = hostAtLater.split(separator)[0]

      // path
      let pathAtLater = hostAtLater.substr(host.length + separator.length)
      let qindex = pathAtLater.indexOf("?")
      let path = null
      let query: { [key: string]: string} = {}
      if (qindex !== -1) {
        path = pathAtLater.substr(0, qindex)
        // query
        let queryAtLater = pathAtLater.substr(path.length + 1)
        let keyValues = queryAtLater.split("&")
        keyValues.forEach( (keyValue) => {
          let arr = keyValue.split("=")
          query[arr[0]] = arr[1]
        })
      } else {
        path = pathAtLater
      }

      // Success.
      return new HTTPURL(scheme, host, path, query)
    }
  }

