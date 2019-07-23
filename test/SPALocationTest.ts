import { describe, it } from "mocha"
import { assert } from "chai"
import SPALocation from "../src/Infrastructure/SPALocation"

describe("SPALocation", () => {

    it("Returned value of shared() is not null.", () => {
        let location = {}
        location["hash"] = "hash"
        location["href"] = "http://xxxx.api.host.com/api/#/order/sub/under?page=10"
        global["location"] = location

        assert.isNotNull(SPALocation.shared())
    })

    it("Returned value of scene() is as expected.", () => {
        let location = {}
        location["hash"] = "hash"
        location["href"] = "http://xxxx.api.host.com/api/#/order/sub/under?page=10"
        global["location"] = location
        assert.equal(SPALocation.shared().scene(), "order")
    })

    it("Returned value of paths() is as expected.", () => {
        let location = {}
        location["hash"] = "hash"
        location["href"] = "http://xxxx.api.host.com/api/#/order/sub/under?page=10"
        global["location"] = location
        assert.equal(SPALocation.shared().paths()[0], "sub")
        assert.equal(SPALocation.shared().paths()[1], "under")
    })

    it("Returned value of query() is as expected.", () => {
        let location = {}
        location["hash"] = "hash"
        location["href"] = "http://xxxx.api.host.com/api/#/order/sub/under?page=10"
        global["location"] = location
        assert.equal(SPALocation.shared().query()["page"], "10")
    })

    it("Returned value is null.", () => {
        let location = {}
        location["hash"] = "hash"
        location["href"] = "http://xxxx.api.host.com"
        global["location"] = location
        assert.isNull(SPALocation.shared().scene())
        assert.isNull(SPALocation.shared().paths())
        assert.isNull(SPALocation.shared().query())
    })
})
