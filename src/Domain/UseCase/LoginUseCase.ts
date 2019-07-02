import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"

export default class LoginUseCase {

    conduit = new ConduitProductionRepository()
    storage = new UserLocalStorageRepository()

    login = async ( email: string, password: string ) => {
        return this.conduit.login(email, password ).then( (user) => {
            this.storage.setUser( user )
        })
    }
}
