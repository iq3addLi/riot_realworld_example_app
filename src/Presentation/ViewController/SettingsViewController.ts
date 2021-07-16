import { RiotCoreComponent } from "riot"
import SettingsUseCase from "../../Domain/UseCase/SettingsUseCase"

export default class SettingsViewController {

    // Outlets
    view: RiotCoreComponent|any
    headerView: RiotCoreComponent|any

    // Usecase
    private useCase = new SettingsUseCase()

    // Lifecycle
    viewWillAppear = () => {
        if ( this.useCase.isLoggedIn() === false ) {
            this.useCase.jumpToNotFound()
            return
        }
    }
    viewDidAppear = () => {
        // setup header
        this.headerView.setItems( this.useCase.menuItems() )

        // setup form
        this.view.setUser( this.useCase.loggedUser() )
    }

    // Public
    postProfile = ( email: string, username: string, bio: string, image: string, password: string ) => {
        this.useCase.post(email, username, bio, image, password).then( () => {
            // success
            this.useCase.jumpToHome()
        }).catch( (error) => {
            // failure
            if (error instanceof Array ) {
                this.view.setErrorMessages( error.map( (aError) => aError.message ) )
            } else if ( error instanceof Error ) {
                this.view.setErrorMessages( [ error.message ] )
            }
        })
    }

    logout = () => {
        this.useCase.logoutThenJumpToHome()
    }
}
