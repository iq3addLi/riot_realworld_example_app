import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"

export default class LoginUseCase {

    conduit = new ConduitProductionRepository()
    storage = new UserLocalStorageRepository()

    login = ( email: string, password: string ) => {
        return new Promise<void>( (resolve, reject) => {
            this.conduit.login(email, password ).then((user) => {
                this.storage.setUser( user )
                resolve()
            }).catch((error) => {
                reject(error)
            })
        })
    }

}
