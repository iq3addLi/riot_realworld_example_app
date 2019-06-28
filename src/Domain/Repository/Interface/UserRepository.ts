import User from "../../Model/User"

export default interface UserRepository {
    user?: () => User
    setUser: (user: User) => void
    isLoggedIn: () => boolean
}
