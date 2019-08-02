import UserRepository from "./interface/UserRepository"
import User from "../Model/User"
import jwt_decode from "jwt-decode"

export default class UserLocalStorageRepository implements UserRepository {

    user = () => {
        let value = localStorage.getItem("user")
        if ( value == null ) { return null }
        const user = User.init(JSON.parse( value ))

        // check expired
        let decoded = jwt_decode( user.token )
        let now = Date.now() / 1000 // mili sec
        let exp = Number(decoded["exp"]) // sec
        if ( now > exp ) {
            this.setUser(null)
            return null
        }

        return user
    }

    setUser = (user: User) => {
        if ( user ) {
            // set
            const string = JSON.stringify( user )
            localStorage.setItem("user", string )
        } else {
            // remove
            localStorage.removeItem("user")
        }
    }

    isLoggedIn = () => {
        return this.user() != null
    }
}
