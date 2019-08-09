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
        console.log("viewWillAppear")
    }
    viewDidAppear = () => {
        this.headerView.setItems( this.useCase.menuItems() )
    }
}
