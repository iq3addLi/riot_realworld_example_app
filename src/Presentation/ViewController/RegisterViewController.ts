import { RiotCoreComponent } from "riot"
import RegisterUseCase from "../../Domain/UseCase/RegisterUseCase"

export default class RegisterViewController {

    // Outlets
    view: RiotCoreComponent|any
    headerView: RiotCoreComponent|any

    // Usecase
    private useCase = new RegisterUseCase()

    // Lifecycle

    viewWillAppear = () => {
        console.log("viewWillAppear")
    }
    viewDidAppear = () => {
        this.headerView.setItems( this.useCase.menuItems() )
    }

    // Public

    register = ( username: string, email: string, password: string ) => {
        this.useCase.register( username, email, password ).then( () => {
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
