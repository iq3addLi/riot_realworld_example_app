import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"

export default class RegisterUseCase {

    conduit = new ConduitProductionRepository()
    storage = new UserLocalStorageRepository()

    register = async ( username: string, email: string, password: string ) => {
        return this.conduit.register( username, email, password ).then((user) => {
            this.storage.setUser( user )
        })
    }
}
