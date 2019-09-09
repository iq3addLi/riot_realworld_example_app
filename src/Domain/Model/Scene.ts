import { RiotComponentShell } from "riot"

export default interface Scene {
    name: string
    component: RiotComponentShell
    filter?: string
    props?: object
}
