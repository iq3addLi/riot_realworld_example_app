import { describe, it } from "mocha"
import { assert } from "chai"
import SPALocation from "../src/Infrastructure/SPALocation"

// Common pre-processing
let location = {}
location["hash"] = "hash"
location["href"] = "http://xxxx.api.host.com/api/#/order/sub/under?page=10"
global["location"] = location

describe("SPALocation", () => {
    it("Returned value of shared() is not null.", () => {
        assert.isNotNull(SPALocation.shared())
    })

    it("Returned value of application() is as expected.", () => {
        assert.equal(SPALocation.shared().application(), "order")
    })

    it("Returned value of paths() is as expected.", () => {
        assert.equal(SPALocation.shared().paths()[0], "sub")
        assert.equal(SPALocation.shared().paths()[1], "under")
    })

    it("Returned value of query() is as expected.", () => {
        assert.equal(SPALocation.shared().query()["page"], "10")
    })
})
