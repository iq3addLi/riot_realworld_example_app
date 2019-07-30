import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import MenuItemsBuilder from "../Utility/MenuItemsBuilder"
import SPALocation from "../../Infrastructure/SPALocation"

export default class LoginUseCase {

    private conduit = new ConduitProductionRepository()
    private storage = new UserLocalStorageRepository()

    private state: LoginState

    constructor() {
        this.state = new LoginState( SPALocation.shared() )
    }

    login = async ( email: string, password: string ) => {
        return this.conduit.login(email, password ).then( (user) => {
            this.storage.setUser( user )
        })
    }

    menuItems = () => {
        return new MenuItemsBuilder().items( this.state.scene, this.storage.user() )
    }
}

class LoginState {
    scene: string // article

    constructor( location: SPALocation ) {
        // scene
        this.scene = location.scene()
    }
}
