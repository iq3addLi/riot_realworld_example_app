import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import PostUser from "../Model/PostUser"

export default class SettingsUseCase {

    storage = new UserLocalStorageRepository()
    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }
    loggedUser = () => {
        return this.storage.user()
    }

    requestUser = () => {
        // ユーザー情報リクエストのPromiseを返す
    }

    post = (user: PostUser) => {
        // ユーザー更新処理のPromiseを返す
    }
}
