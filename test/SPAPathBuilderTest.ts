import { describe, it } from "mocha"
import { assert } from "chai"
import SPAPathBuilder from "../src/Infrastructure/SPAPathBuilder"


describe("SPAPathBuilder", () => {

    // Common pre-processing
    let location = {}
    location["hash"] = "hash"
    location["href"] = "http://xxxx.api.host.com/"
    global["location"] = location

    it("1", () => {
        let builder = new SPAPathBuilder()
        assert.equal(builder.path(), "")
        assert.equal(builder.fullPath(), "http://xxxx.api.host.com")
    })

    it("2", () => {
        let builder = new SPAPathBuilder("scene")
        assert.equal(builder.path(), "#/scene")
        assert.equal(builder.fullPath(), "http://xxxx.api.host.com/#/scene")
    })

    it("3", () => {
        let builder = new SPAPathBuilder("scene", [ "first", "second", "third" ])
        assert.equal(builder.path(), "#/scene/first/second/third")
        assert.equal(builder.fullPath(), "http://xxxx.api.host.com/#/scene/first/second/third")
    })

    it("4", () => {
        let builder = new SPAPathBuilder("scene", [ "first", "second", "third" ], { "page": "10", "limit": "999" })
        assert.equal(builder.path(), "#/scene/first/second/third?page=10&limit=999")
        assert.equal(builder.fullPath(), "http://xxxx.api.host.com/#/scene/first/second/third?page=10&limit=999")
    })
})
