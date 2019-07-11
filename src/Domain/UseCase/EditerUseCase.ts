import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"

export default class EditerUseCase {

    storage = new UserLocalStorageRepository()
    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }
    loggedUser = () => {
        return this.storage.user()
    }
}
