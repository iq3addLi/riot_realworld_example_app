import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import MenuItemsBuilder from "../Utility/MenuItemsBuilder"
import SPALocation from "../../Infrastructure/SPALocation"

export default class RegisterUseCase {

    private conduit = new ConduitProductionRepository()
    private storage = new UserLocalStorageRepository()

    private state: RegisterState

    constructor() {
        this.state = new RegisterState( SPALocation.shared() )
    }

    register = async ( username: string, email: string, password: string ) => {
        return this.conduit.register( username, email, password ).then((user) => {
            this.storage.setUser( user )
        })
    }

    menuItems = () => {
        return new MenuItemsBuilder().items( this.state.scene, this.storage.user() )
    }
}

class RegisterState {
    scene: string

    constructor( location: SPALocation ) {
        // scene
        this.scene = location.scene()
    }
}
