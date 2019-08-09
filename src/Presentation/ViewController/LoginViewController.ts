import { RiotCoreComponent } from "riot"
import LoginUseCase from "../../Domain/UseCase/LoginUseCase"

export default class LoginViewController {

    // Outlets
    view: RiotCoreComponent|any
    headerView: RiotCoreComponent|any

    // Usecase
    private useCase = new LoginUseCase()

    // Lifecycle

    viewWillAppear = () => {
        console.log("viewWillAppear")
    }

    viewDidAppear = () => {
        this.headerView.setItems( this.useCase.menuItems() )
    }

    // Public
    login = ( email: string, password: string ) => {
        this.useCase.login( email, password ).then( () => {
            // success
            window.location.href = "/"
        }).catch( (error) => {
            // failure
            if (error instanceof Array ) {
                this.view.setErrorMessages( error.map( (aError) => aError.message ) )
            } else if ( error instanceof Error ) {
                this.view.setErrorMessages( [ error.message ] )
            }
        })
    }
}
