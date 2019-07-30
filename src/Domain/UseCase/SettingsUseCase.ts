import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import PostUser from "../Model/PostUser"
import MenuItemsBuilder from "../Utility/MenuItemsBuilder"
import SPALocation from "../../Infrastructure/SPALocation"
import ConduitProductionRepository from "../Repository/ConduitProductionRepository"

export default class SettingsUseCase {

    private conduit = new ConduitProductionRepository()
    private storage = new UserLocalStorageRepository()

    private state: SettingsState

    constructor() {
        this.state = new SettingsState( SPALocation.shared() )
    }

    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }
    loggedUser = () => {
        return this.storage.user()
    }

    menuItems = () => {
        return new MenuItemsBuilder().items( this.state.scene, this.storage.user() )
    }

    requestUser = () => {

    }

    post = (user: PostUser) => {

    }

    logoutAfterJumpToHome = () => {
        this.storage.setUser( null )
        location.href = "/"
    }
}

class SettingsState {
    scene: string // article

    constructor( location: SPALocation ) {
        // scene
        this.scene = location.scene()
    }
}
