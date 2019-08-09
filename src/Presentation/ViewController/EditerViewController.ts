import { RiotCoreComponent } from "riot"
import EditerUseCase from "../../Domain/UseCase/EditerUseCase"

export default class EditerViewController {

    // Outlets
    view: RiotCoreComponent|any
    headerView: RiotCoreComponent|any

    // Usecase
    private useCase = new EditerUseCase()

    // Lifecycle

    viewWillAppear = () => {
        console.log("viewWillAppear")
    }
    viewDidAppear = () => {
        this.headerView.setItems( this.useCase.menuItems() )
    }
}
