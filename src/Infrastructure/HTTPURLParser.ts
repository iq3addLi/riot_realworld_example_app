import HTTPURL from "./HTTPURL"
import { NOTFOUND } from "dns"

/// Easliy HTTP(S) URL Parser for SPA. ftp, ssh, git and other is not supported. port unsupported ;)
export default class HTTPURLParser {

    static parse = ( urlString: string ) => {
      // scheme
      const slasher = "://"
      let index = urlString.indexOf(slasher)
      if (index === -1) {
        return null // not url
      }
      let scheme = urlString.substr(0, index)

      // host
      const separator = "/"
      let afterScheme = urlString.substr(index + slasher.length)
      let hindex = afterScheme.indexOf(separator)
      let host = null
      if (hindex !== -1) {
        host = afterScheme.substr(hindex)
      }

      // path
      let afterHost = afterScheme.substr(host.length + separator.length)
      let qindex = afterHost.indexOf("?")
      let path = null
      let query: { [key: string]: string} = {}
      if (qindex !== -1) {
        if (afterHost.split("?").length > 2) {
          return null // unexpected query.
        }
        path = afterHost.substr(0, qindex)
        if ( path.length <= 0) {
          return null // unexpected path
        }
        // query
        let afterPath = afterHost.substr(path.length + 1)
        let keyValues = afterPath.split("&")
        for (let i in keyValues) {
          let keyValue = keyValues[i]
          let arr = keyValue.split("=")
          if (arr.length !== 2) {
            return null // unexpected key-value.
          }
          query[arr[0]] = arr[1]
        }
      } else {
        if ( afterHost.length > 1 ) {
          path = afterHost
        }
      }

      // port
      let pindex = host.indexOf(":")
      let port: number = null
      if ( pindex !== -1 ) {
        let hostAndPort = host.split(":")
        if (hostAndPort.length === 2) {
          host = hostAndPort[0]
          if (Number.isNaN(Number(hostAndPort[1]))) {
            return null // unexpected port.
          } else {
            port = Number(hostAndPort[1])
          }
        }
      }

      // Success.
      return new HTTPURL(scheme, host, path, query, port)
    }
  }

