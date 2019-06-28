import UserRepository from "./interface/UserRepository"
import User from "../Model/User"

export default class UserLocalStorageRepository implements UserRepository {

    user = () => {
        let value = localStorage.getItem("user")
        if ( value == null ) {
            return null
        } else {
            const object = JSON.parse( value )
            return User.init(object)
        }
    }

    setUser = (user: User) => {
        const string = JSON.stringify( user )
        localStorage.setItem("user", string )
    }

    isLoggedIn = () => {
        return this.user() != null // todo: need check for expire
    }
}
