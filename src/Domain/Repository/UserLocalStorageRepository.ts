import UserRepository from "./interface/UserRepository"
import User from "../Model/User"
import jwt_decode from "jwt-decode"

export default class UserLocalStorageRepository implements UserRepository {

    user = () => {
        const value = localStorage.getItem("user")
        if ( value == null ) { return null }
        const user = User.init(JSON.parse( value ))

        // check expired
        const decoded = jwt_decode( user.token )
        const now = Date.now() / 1000 // mili sec
        const exp = Number(decoded["exp"]) // sec
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
