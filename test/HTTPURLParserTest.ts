import { describe, it } from "mocha"
import { assert } from "chai"
import HTTPURLParser from "../src/Infrastructure/HTTPURLParser"

describe("HTTPURLParser", () => {
    it("HTTPURL is as expected.", () => {
        let url = new HTTPURLParser().parse("http://xxxxx.api.com")
        assert.equal(url.scheme, "http")
        assert.equal(url.host, "xxxxx.api.com")
        assert.isNull(url.port)
        assert.isNull(url.path)
        assert.isNull(url.query)
    })

    it("The result of parsing the URL containing the path is as expected.", () => {
        let url = new HTTPURLParser().parse("http://xxxxx.api.com/api")
        assert.equal(url.scheme, "http")
        assert.equal(url.host, "xxxxx.api.com")
        assert.isNull(url.port)
        assert.equal(url.path, "api")
        assert.isNull(url.query)
    })

    it("The result of parsing the URL containing the query is as expected.", () => {
        let url = new HTTPURLParser().parse("http://xxxxx.api.com/api?page=10")
        assert.equal(url.scheme, "http")
        assert.equal(url.host, "xxxxx.api.com")
        assert.isNull(url.port)
        assert.equal(url.path, "api")
        assert.equal(url.query["page"], "10")
    })

    it("The URL for SPA is parsed as expected.", () => {
        let url = new HTTPURLParser().parse("http://xxxxx.api.com/api/#/spa/action/sub?page=10&limit=20")
        assert.equal(url.scheme, "http")
        assert.equal(url.host, "xxxxx.api.com")
        assert.isNull(url.port)
        assert.equal(url.path, "api/#/spa/action/sub")
        assert.equal(url.query["page"], "10")
        assert.equal(url.query["limit"], "20")
    })

    it("URL including port is parsed as expected.", () => {
        let url = new HTTPURLParser().parse("http://xxxxx.api.com:8080/api/#/spa/action/sub?page=10&limit=20")
        assert.equal(url.scheme, "http")
        assert.equal(url.host, "xxxxx.api.com")
        assert.equal(url.port, 8080)
        assert.equal(url.path, "api/#/spa/action/sub")
        assert.equal(url.query["page"], "10")
        assert.equal(url.query["limit"], "20")
    })

    it("URL including wrong port is parsed as expected.", () => {
        let url = new HTTPURLParser().parse("http://xxxxx.api.com:xxxx/api/#/spa/action/sub?page=10&limit=20")
        assert.isNull(url)
    })

    it("Wrong URL is parsed as expected.", () => {
        let parser = new HTTPURLParser()
        let url = parser.parse("xxxxx.api.com:xxxx/api/#/spa/action/sub?page=10&limit=20")
        assert.isNull(url)
        url = parser.parse("http://xxxxx.api.com/?page=10&limit=20")
        assert.isNull(url)
        url = parser.parse("http://xxxxx.api.com?page=10&limit=20")
        assert.isNull(url)
        url = parser.parse("http://xxxxx.api.com/a?page=10&limit=20")
        assert.equal(url.scheme, "http")
        assert.equal(url.host, "xxxxx.api.com")
        assert.isNull(url.port)
        assert.equal(url.path, "a")
        assert.equal(url.query["page"], "10")
        assert.equal(url.query["limit"], "20")
    })

    it("URL including wrong query is parsed as expected.", () => {

        let parser = new HTTPURLParser()
        let url = parser.parse("http://xxxxx.api.com/api/#/spa/action/sub?page=====10")
        assert.isNull(url)
        url = parser.parse("http://xxxxx.api.com/api/#/spa/action/sub??????page=10")
        assert.isNull(url)
        url = parser.parse("http://xxxxx.api.com/api/#/spa/action/sub?page==a==10")
        assert.isNull(url)
    })
})
