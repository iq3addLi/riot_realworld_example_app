// This code is unuse.
export default interface Initializable {
    /*static*/ init: <T>(object: any) => T // Typescript is can't defined static method on Interface :(
}

// abstruct class Initializable {
//     static init: <T>(object: any) => T // Typescript is can't use `this` keyword on abstract class ;(
// }
