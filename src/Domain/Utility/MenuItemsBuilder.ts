import MenuItem from "../Model/MenuItem"
import User from "../Model/User"

export default class MenuItemsBuilder {

    items = ( scene: string, user?: User ) => {
        if (user !== null) {
            return [
                new MenuItem( "articles", "Home", "#/", (scene === "articles")),
                new MenuItem( "editer", "New Article", "#/editer", (scene === "editer"), "ion-compose"),
                new MenuItem( "settings", "Settings", "#/settings", (scene === "settings"), "ion-gear-a"),
                new MenuItem( "profile", user.username, "#/profile/" + user.username, (scene === "profile"), null, user.image )
            ]
        } else {
            return [
                new MenuItem( "articles", "Home", "#/", (scene === "articles")),
                new MenuItem( "login", "Sign In", "#/login", (scene === "login")),
                new MenuItem( "register", "Sign Up", "#/register", (scene === "register"))
            ]
        }
    }
}
